import { BaseRepository } from '@/shared/repositories/base.repository';
import type { TenantScope } from '@/shared/repositories/types';
import { Poll } from '../entities/poll.entity';
import { PollOption } from '../entities/poll-option.entity';
import { Vote } from '../entities/vote.entity';

export class PollRepository extends BaseRepository<Poll> {
  constructor() {
    super(Poll, {
      alias: 'poll',
      searchableFields: ['title', 'description'],
      filterableFields: ['condominiumId', 'assemblyId', 'status', 'voterType'],
      relations: ['options'],
      defaultSort: { field: 'startsAt', order: 'DESC' },
      condominiumField: 'condominiumId',
    });
  }

  async findOptions(scope: TenantScope, pollId: string): Promise<PollOption[]> {
    return this.repository.manager
      .getRepository(PollOption)
      .createQueryBuilder('option')
      .where('option.pollId = :pollId', { pollId })
      .andWhere('option.tenantId = :tenantId', { tenantId: scope.tenantId })
      .orderBy('option.sortOrder', 'ASC')
      .getMany();
  }

  async hasVoted(scope: TenantScope, pollId: string, unitId: string): Promise<boolean> {
    return this.repository.manager
      .getRepository(Vote)
      .createQueryBuilder('vote')
      .where('vote.pollId = :pollId', { pollId })
      .andWhere('vote.unitId = :unitId', { unitId })
      .andWhere('vote.tenantId = :tenantId', { tenantId: scope.tenantId })
      .getExists();
  }

  async listVotes(scope: TenantScope, pollId: string): Promise<Vote[]> {
    return this.repository.manager
      .getRepository(Vote)
      .createQueryBuilder('vote')
      .where('vote.pollId = :pollId', { pollId })
      .andWhere('vote.tenantId = :tenantId', { tenantId: scope.tenantId })
      .orderBy('vote.votedAt', 'DESC')
      .getMany();
  }
}

export const pollRepository = new PollRepository();
