import { AppDataSource } from '@/config/data-source';
import { BusinessRuleError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import type { RequestContext } from '@/shared/services/request-context';
import { CommonArea } from './common-area.entity';
import { commonAreaRepository, type CommonAreaRepository } from './common-area.repository';
import type { CreateCommonAreaDTO, UpdateCommonAreaDTO } from './common-area.schema';

export class CommonAreaService extends CondominiumScopedService<
  CommonArea,
  CreateCommonAreaDTO,
  UpdateCommonAreaDTO
> {
  constructor(repository: CommonAreaRepository = commonAreaRepository) {
    super(repository, { resource: 'common-area', label: 'Area comum' });
  }

  protected override async beforeRemove(ctx: RequestContext, entity: CommonArea): Promise<void> {
    const row = await AppDataSource.createQueryBuilder()
      .select('COUNT(1)', 'total')
      .from('reservations', 'reservation')
      .where('reservation.common_area_id = :areaId', { areaId: entity.id })
      .andWhere('reservation.tenant_id = :tenantId', { tenantId: ctx.scope.tenantId })
      .andWhere('reservation.deleted_at IS NULL')
      .andWhere("reservation.status IN ('PENDING','CONFIRMED')")
      .andWhere('reservation.starts_at >= :now', { now: new Date() })
      .getRawOne<{ total: string }>();

    if (Number(row?.total ?? 0) > 0) {
      throw new BusinessRuleError(
        'Existem reservas futuras para esta area. Cancele-as antes de remover.',
      );
    }
  }
}

export const commonAreaService = new CommonAreaService();
