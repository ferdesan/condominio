import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Every row that belongs to a customer (administradora) carries its tenant id.
 * The scoped repository layer injects this column on all reads/writes, so a
 * missing `where` clause can never leak data across tenants.
 */
export abstract class TenantScopedEntity extends BaseEntity {
  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;
}
