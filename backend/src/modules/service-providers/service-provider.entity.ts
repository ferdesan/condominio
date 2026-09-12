import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const PROVIDER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/** Prestador de servico contratado pelo condominio. */
@Entity('service_providers')
@Index(['tenantId', 'condominiumId'])
export class ServiceProvider extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'company_name', type: 'varchar', length: 150 })
  companyName: string;

  @Column({ name: 'trade_name', type: 'varchar', length: 150, nullable: true })
  tradeName?: string | null;

  @Column({ type: 'varchar', length: 14, nullable: true })
  document?: string | null;

  @Column({ name: 'service_type', type: 'varchar', length: 100 })
  serviceType: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 150, nullable: true })
  contactName?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: ProviderStatus;

  @Column({ name: 'contract_start', type: 'date', nullable: true })
  contractStart?: string | null;

  @Column({ name: 'contract_end', type: 'date', nullable: true })
  contractEnd?: string | null;

  @Column({ type: 'int', nullable: true })
  rating?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
