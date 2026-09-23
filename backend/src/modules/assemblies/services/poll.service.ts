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
import type {
  CastProxyVoteDTO,
  CastVoteDTO,
  CreatePollDTO,
  UpdatePollDTO,
} from '../schemas/assembly.schema';

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

export type UnitVoteStatusValue = 'VOTED' | 'PENDING' | 'NOT_ELIGIBLE';

export type UnitVoteStatus = {
  unitId: string;
  unitNumber: string;
  status: UnitVoteStatusValue;
};

export function selectProxyVoterIdentity(
  isSecret: boolean,
  resident: { userId?: string | null; name: string } | null,
): { voterId: string | null; voterName: string | null } {
  if (isSecret || !resident) {
    return { voterId: null, voterName: null };
  }
  return { voterId: resident.userId ?? null, voterName: resident.name };
}

export function unitIsEligible(
  voterType: Poll['voterType'],
  unitId: string,
  ownerUnitIds: ReadonlySet<string>,
): boolean {
  if (voterType === 'ALL_RESIDENTS') return true;
  return ownerUnitIds.has(unitId);
}

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
    // `status` nao vem do schema de update; open()/close() enviam via cast.
    const status = (dto as { status?: Poll['status'] }).status;
    if (status !== undefined && status !== current.status) {
      const canOpen = current.status === 'DRAFT' && status === 'OPEN';
      const canClose = current.status === 'OPEN' && status === 'CLOSED';
      if (!canOpen && !canClose) {
        throw new BusinessRuleError('Transicao de status nao permitida.');
      }
    }

    if (current.status !== 'DRAFT') {
      const periodChanged =
        (dto.startsAt && dto.startsAt.getTime() !== current.startsAt.getTime()) ||
        (dto.endsAt && dto.endsAt.getTime() !== current.endsAt.getTime()) ||
        (dto.weightedByFraction !== undefined &&
          dto.weightedByFraction !== current.weightedByFraction);
      if (periodChanged) {
        throw new BusinessRuleError(
          'Votacoes abertas ou encerradas nao podem ter periodo ou regra de peso alterados.',
        );
      }
    }

    const rulesLocked = current.status !== 'DRAFT' || current.totalVotes > 0;
    if (rulesLocked) {
      if (dto.voterType !== undefined && dto.voterType !== current.voterType) {
        throw new BusinessRuleError('Publico da votacao nao pode ser alterado apos o rascunho.');
      }
      if (dto.isSecret !== undefined && dto.isSecret !== current.isSecret) {
        throw new BusinessRuleError('Segredo do voto nao pode ser alterado apos o rascunho.');
      }
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

    const userIds = await this.openPollRecipients(ctx, poll);
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
    if (poll.status !== 'OPEN') {
      throw new BusinessRuleError('Somente votacoes abertas podem ser encerradas.');
    }

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
      const ownerUnitIds = await this.loadOwnerUnitIds(ctx.scope, poll.condominiumId);
      if (!unitIsEligible(poll.voterType, unitId, ownerUnitIds)) {
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

    await this.persistVote(ctx, poll, option, {
      unitId,
      voterId: poll.isSecret ? null : ctx.actor.userId,
      voterName: poll.isSecret ? null : ctx.actor.name,
      registeredByUserId: null,
      weight,
      auditDescription: poll.isSecret
        ? 'Voto secreto registrado.'
        : `Voto registrado para a opcao ${option.label}.`,
      auditActor: poll.isSecret ? null : ctx.actor,
    });

    const results = await this.results(ctx, pollId);
    this.realtime.emitToCondominium(poll.condominiumId, 'poll:updated', results);
    return results;
  }

  /**
   * Registra o voto de uma unidade em nome do morador (gestao manual do sindico/admin).
   * O `unitId` vem do corpo; o operador e gravado em `registered_by_user_id`.
   */
  async castVoteOnBehalf(
    ctx: RequestContext,
    pollId: string,
    dto: CastProxyVoteDTO,
  ): Promise<PollResults> {
    const poll = await this.findById(ctx, pollId);

    if (poll.status !== 'OPEN') throw new BusinessRuleError('Esta votacao nao esta aberta.');
    if (dayjs().isBefore(dayjs(poll.startsAt))) {
      throw new BusinessRuleError('A votacao ainda nao foi iniciada.');
    }
    if (dayjs().isAfter(dayjs(poll.endsAt))) {
      throw new BusinessRuleError('O prazo para votar ja encerrou.');
    }

    const unit = await this.units.findById(ctx.scope, dto.unitId);
    if (!unit || unit.condominiumId !== poll.condominiumId) {
      throw new ForbiddenError('A unidade informada nao participa desta votacao.');
    }

    const ownerUnitIds =
      poll.voterType === 'OWNERS'
        ? await this.loadOwnerUnitIds(ctx.scope, poll.condominiumId)
        : new Set<string>();
    if (!unitIsEligible(poll.voterType, dto.unitId, ownerUnitIds)) {
      throw new ForbiddenError('Esta deliberacao e restrita aos proprietarios.');
    }

    if (await this.polls.hasVoted(ctx.scope, pollId, dto.unitId)) {
      throw new ConflictError('Esta unidade ja registrou voto nesta deliberacao.');
    }

    const options = await this.polls.findOptions(ctx.scope, pollId);
    const option = options.find((item) => item.id === dto.optionId);
    if (!option) throw new NotFoundError('Opcao de votacao');

    const weight = poll.weightedByFraction ? (unit.idealFraction ?? 0) || 1 : 1;

    const resident = poll.isSecret
      ? null
      : await this.findActiveResidentForProxy(ctx.scope, dto.unitId);
    const identity = selectProxyVoterIdentity(poll.isSecret, resident);

    await this.persistVote(ctx, poll, option, {
      unitId: dto.unitId,
      voterId: identity.voterId,
      voterName: identity.voterName,
      registeredByUserId: ctx.actor.userId,
      weight,
      auditDescription: `Voto registrado pelo administrador para a unidade ${unit.number ?? unit.id} (opcao ${option.label}).`,
      auditActor: ctx.actor,
    });

    const results = await this.results(ctx, pollId);
    this.realtime.emitToCondominium(poll.condominiumId, 'poll:updated', results);
    return results;
  }

  private async loadOwnerUnitIds(
    scope: RequestContext['scope'],
    condominiumId: string,
  ): Promise<Set<string>> {
    const owners = await this.residents.listActiveOwnersByCondominium(scope, condominiumId);
    return new Set(owners.map((owner) => owner.unitId));
  }

  /** Destinatarios de "votacao aberta": elegiveis quando OWNERS; senao o condominio. */
  private async openPollRecipients(ctx: RequestContext, poll: Poll): Promise<string[]> {
    const tenantId = ctx.scope.tenantId;
    if (poll.voterType !== 'OWNERS') {
      return this.recipients.usersOfCondominium(tenantId, poll.condominiumId);
    }

    const ownerUnitIds = await this.loadOwnerUnitIds(ctx.scope, poll.condominiumId);
    const batches = await Promise.all(
      [...ownerUnitIds].map((unitId) => this.recipients.usersOfUnit(tenantId, unitId)),
    );
    return [...new Set(batches.flat())];
  }

  private async findActiveResidentForProxy(
    scope: RequestContext['scope'],
    unitId: string,
  ): Promise<{ userId?: string | null; name: string } | null> {
    const residents = await this.residents.listActiveByUnit(scope, unitId);
    if (!residents.length) return null;
    return residents.find((resident) => resident.isPrimary) ?? residents[0];
  }

  private async persistVote(
    ctx: RequestContext,
    poll: Poll,
    option: PollOption,
    data: {
      unitId: string;
      voterId: string | null;
      voterName: string | null;
      registeredByUserId: string | null;
      weight: number;
      auditDescription: string;
      auditActor: typeof ctx.actor | null;
    },
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(Vote, {
          tenantId: ctx.scope.tenantId,
          pollId: poll.id,
          optionId: option.id,
          unitId: data.unitId,
          voterId: data.voterId,
          voterName: data.voterName,
          registeredByUserId: data.registeredByUserId,
          weight: data.weight,
          votedAt: new Date(),
          ipAddress: poll.isSecret ? null : (ctx.ipAddress ?? null),
        }),
      );

      await manager.increment(PollOption, { id: option.id }, 'votesCount', 1);
      await manager
        .createQueryBuilder()
        .update(PollOption)
        .set({ votesWeight: () => 'votes_weight + :weight' })
        .where('id = :id', { id: option.id })
        .setParameter('weight', data.weight)
        .execute();
      await manager.increment(Poll, { id: poll.id }, 'totalVotes', 1);
    });

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'CREATE',
      resource: 'vote',
      resourceId: poll.id,
      description: data.auditDescription,
      actor: data.auditActor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  /** Voto da unidade do usuario logado, ou null se ainda nao votou. */
  async myVote(
    ctx: RequestContext,
    pollId: string,
  ): Promise<{ voted: boolean; optionId?: string; votedAt?: string }> {
    const poll = await this.findById(ctx, pollId);
    const unitId = ctx.actor.unitId;
    if (!unitId) return { voted: false };

    const votes = await this.polls.listVotes(ctx.scope, pollId);
    const mine = votes.find((vote) => vote.unitId === unitId);
    if (!mine) return { voted: false };

    // Em votacao secreta o voto do usuario e devolvido apenas como confirmacao.
    if (poll.isSecret) return { voted: true };

    return { voted: true, optionId: mine.optionId, votedAt: mine.votedAt.toISOString() };
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

  /** Situacao de voto por unidade: VOTED, PENDING ou NOT_ELIGIBLE, sem opcao. */
  async voteStatus(ctx: RequestContext, pollId: string): Promise<UnitVoteStatus[]> {
    const poll = await this.findById(ctx, pollId);
    const units = await this.units.listByCondominium(ctx.scope, poll.condominiumId);
    const votes = await this.polls.listVotes(ctx.scope, pollId);
    const votedUnitIds = new Set(votes.map((vote) => vote.unitId));
    const ownerUnitIds =
      poll.voterType === 'OWNERS'
        ? await this.loadOwnerUnitIds(ctx.scope, poll.condominiumId)
        : new Set<string>();

    return units.map((unit) => {
      if (votedUnitIds.has(unit.id)) {
        return { unitId: unit.id, unitNumber: unit.number, status: 'VOTED' as const };
      }
      if (!unitIsEligible(poll.voterType, unit.id, ownerUnitIds)) {
        return { unitId: unit.id, unitNumber: unit.number, status: 'NOT_ELIGIBLE' as const };
      }
      return { unitId: unit.id, unitNumber: unit.number, status: 'PENDING' as const };
    });
  }
}

export const pollService = new PollService();
