import type { DeepPartial } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import {
  notificationService,
  type NotificationService,
} from '@/modules/notifications/notification.service';
import { residentRepository, type ResidentRepository } from '@/modules/residents/resident.repository';
import { unitRepository, type UnitRepository } from '@/modules/units/unit.repository';
import { realtimeService, type RealtimeService } from '@/realtime/realtime.service';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { recipientsService, type RecipientsService } from '@/shared/services/recipients.service';
import { assertReferenceExists } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { dayjs } from '@/shared/utils/date.util';
import { Poll } from '../entities/poll.entity';
import { PollOption } from '../entities/poll-option.entity';
import { Vote } from '../entities/vote.entity';
import { pollRepository, type PollRepository } from '../repositories/poll.repository';
import type { CastVoteDTO, CreatePollDTO, UpdatePollDTO } from '../schemas/assembly.schema';

export type PollResults = {
  pollId: string;
  title: string;
  status: Poll['status'];
  totalVotes: number;
  eligibleUnits: number;
  participationPercent: number;
  quorumPercent: number;
  quorumReached: boolean;
  weighted: boolean;
  options: Array<{
    id: string;
    label: string;
    votesCount: number;
    votesWeight: number;
    percent: number;
  }>;
};

export class PollService extends CondominiumScopedService<Poll, CreatePollDTO, UpdatePollDTO> {
  constructor(
    private readonly polls: PollRepository = pollRepository,
    private readonly units: UnitRepository = unitRepository,
    private readonly residents: ResidentRepository = residentRepository,
    private readonly notifications: NotificationService = notificationService,
    private readonly recipients: RecipientsService = recipientsService,
    private readonly realtime: RealtimeService = realtimeService,
  ) {
    super(polls, { resource: 'poll', label: 'Votacao' });
  }

  protected override async prepareCreate(
    ctx: RequestContext,
    dto: CreatePollDTO,
  ): Promise<DeepPartial<Poll>> {
    if (dto.assemblyId) {
      await assertReferenceExists(ctx.scope, 'assemblies', dto.assemblyId);
    }

    const eligibleUnits = await this.units.listByCondominium(ctx.scope, dto.condominiumId);

    return {
      ...dto,
      eligibleUnits: eligibleUnits.length,
      totalVotes: 0,
      options: dto.options.map((option, index) => ({
        tenantId: ctx.scope.tenantId,
        label: option.label,
        description: option.description ?? null,
        sortOrder: index,
      })),
    } as DeepPartial<Poll>;
  }

  protected override async prepareUpdate(
    _ctx: RequestContext,
    current: Poll,
    dto: UpdatePollDTO,
  ): Promise<DeepPartial<Poll>> {
    if (current.status !== 'DRAFT' && (dto.startsAt || dto.endsAt || dto.weightedByFraction)) {
      throw new BusinessRuleError(
        'Votacoes abertas ou encerradas nao podem ter periodo ou regra de peso alterados.',
      );
    }
    return dto as DeepPartial<Poll>;
  }

  protected override async beforeRemove(ctx: RequestContext, entity: Poll): Promise<void> {
    const votes = await this.polls.listVotes(ctx.scope, entity.id);
    if (votes.length) {
      throw new BusinessRuleError('Votacao ja possui votos registrados e nao pode ser removida.');
    }
  }

  async open(ctx: RequestContext, id: string): Promise<Poll> {
    const poll = await this.findById(ctx, id);
    if (poll.status !== 'DRAFT') {
      throw new BusinessRuleError('Somente votacoes em rascunho podem ser abertas.');
    }

    const opened = await this.update(ctx, id, { status: 'OPEN' } as UpdatePollDTO);

    const userIds = await this.recipients.usersOfCondominium(
      ctx.scope.tenantId,
      poll.condominiumId,
    );
    await this.notifications.notify({
      tenantId: ctx.scope.tenantId,
      condominiumId: poll.condominiumId,
      userIds,
      title: 'Nova votacao aberta',
      message: `${poll.title}. Vote ate ${dayjs(poll.endsAt).format('DD/MM/YYYY HH:mm')}.`,
      type: 'ASSEMBLY',
      resource: 'poll',
      resourceId: poll.id,
      actionUrl: `/votacoes/${poll.id}`,
    });

    return opened;
  }

  async close(ctx: RequestContext, id: string): Promise<PollResults> {
    const poll = await this.findById(ctx, id);
    if (poll.status === 'CLOSED') throw new BusinessRuleError('Votacao ja esta encerrada.');

    await this.update(ctx, id, {
      status: 'CLOSED',
      resultsPublishedAt: new Date(),
    } as UpdatePollDTO);

    const results = await this.results(ctx, id);
    this.realtime.emitToCondominium(poll.condominiumId, 'poll:updated', results);
    return results;
  }

  /**
   * Registra o voto da unidade do usuario logado.
   *
   * Garantias: (a) uma unidade vota uma unica vez — indice unico no banco;
   * (b) o peso do voto respeita a fracao ideal quando a votacao e ponderada;
   * (c) votacao secreta nao guarda o autor do voto.
   */
  async castVote(ctx: RequestContext, pollId: string, dto: CastVoteDTO): Promise<PollResults> {
    const poll = await this.findById(ctx, pollId);

    if (poll.status !== 'OPEN') throw new BusinessRuleError('Esta votacao nao esta aberta.');
    if (dayjs().isBefore(dayjs(poll.startsAt))) {
      throw new BusinessRuleError('A votacao ainda nao foi iniciada.');
    }
    if (dayjs().isAfter(dayjs(poll.endsAt))) {
      throw new BusinessRuleError('O prazo para votar ja encerrou.');
    }

    const unitId = ctx.actor.unitId;
    if (!unitId) {
      throw new ForbiddenError('Apenas usuarios vinculados a uma unidade podem votar.');
    }

    const unit = await this.units.findById(ctx.scope, unitId);
    if (!unit || unit.condominiumId !== poll.condominiumId) {
      throw new ForbiddenError('Sua unidade nao participa desta votacao.');
    }

    if (poll.voterType === 'OWNERS') {
      const resident = await this.residents.findByUser(ctx.scope, ctx.actor.userId);
      if (!resident || resident.type !== 'OWNER') {
        throw new ForbiddenError('Esta deliberacao e restrita aos proprietarios.');
      }
    }

    if (await this.polls.hasVoted(ctx.scope, pollId, unitId)) {
      throw new ConflictError('Esta unidade ja registrou voto nesta deliberacao.');
    }

    const options = await this.polls.findOptions(ctx.scope, pollId);
    const option = options.find((item) => item.id === dto.optionId);
    if (!option) throw new NotFoundError('Opcao de votacao');

    const weight = poll.weightedByFraction ? (unit.idealFraction ?? 0) || 1 : 1;

    await AppDataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(Vote, {
          tenantId: ctx.scope.tenantId,
          pollId,
          optionId: option.id,
          unitId,
          voterId: poll.isSecret ? null : ctx.actor.userId,
          voterName: poll.isSecret ? null : ctx.actor.name,
          weight,
          votedAt: new Date(),
          ipAddress: ctx.ipAddress ?? null,
        }),
      );

      await manager.increment(PollOption, { id: option.id }, 'votesCount', 1);
      await manager
        .createQueryBuilder()
        .update(PollOption)
        .set({ votesWeight: () => 'votes_weight + :weight' })
        .where('id = :id', { id: option.id })
        .setParameter('weight', weight)
        .execute();
      await manager.increment(Poll, { id: pollId }, 'totalVotes', 1);
    });

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'CREATE',
      resource: 'vote',
      resourceId: pollId,
      description: poll.isSecret
        ? 'Voto secreto registrado.'
        : `Voto registrado para a opcao ${option.label}.`,
      actor: poll.isSecret ? null : ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    const results = await this.results(ctx, pollId);
    this.realtime.emitToCondominium(poll.condominiumId, 'poll:updated', results);
    return results;
  }

  async results(ctx: RequestContext, pollId: string): Promise<PollResults> {
    const poll = await this.findById(ctx, pollId);
    const options = await this.polls.findOptions(ctx.scope, pollId);

    const totalWeight = options.reduce((sum, option) => sum + Number(option.votesWeight ?? 0), 0);
    const totalCount = options.reduce((sum, option) => sum + option.votesCount, 0);
    const denominator = poll.weightedByFraction ? totalWeight : totalCount;

    const participationPercent =
      poll.eligibleUnits > 0 ? (totalCount / poll.eligibleUnits) * 100 : 0;

    return {
      pollId: poll.id,
      title: poll.title,
      status: poll.status,
      totalVotes: totalCount,
      eligibleUnits: poll.eligibleUnits,
      participationPercent: Math.round(participationPercent * 100) / 100,
      quorumPercent: poll.quorumPercent,
      quorumReached: participationPercent >= poll.quorumPercent,
      weighted: poll.weightedByFraction,
      options: options.map((option) => {
        const value = poll.weightedByFraction ? Number(option.votesWeight ?? 0) : option.votesCount;
        return {
          id: option.id,
          label: option.label,
          votesCount: option.votesCount,
          votesWeight: Number(option.votesWeight ?? 0),
          percent: denominator > 0 ? Math.round((value / denominator) * 10000) / 100 : 0,
        };
      }),
    };
  }

  /** Lista os votos de uma deliberacao aberta (indisponivel quando secreta). */
  async listVotes(ctx: RequestContext, pollId: string): Promise<Vote[]> {
    const poll = await this.findById(ctx, pollId);
    if (poll.isSecret) {
      throw new ForbiddenError('Votacao secreta: os votos individuais nao podem ser consultados.');
    }
    return this.polls.listVotes(ctx.scope, pollId);
  }
}

export const pollService = new PollService();
