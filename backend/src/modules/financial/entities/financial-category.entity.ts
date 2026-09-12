import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

export const CATEGORY_KINDS = ['INCOME', 'EXPENSE'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Plano de contas simplificado do condominio. */
@Entity('financial_categories')
@Index(['tenantId', 'condominiumId', 'name'], { unique: true })
export class FinancialCategory extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'EXPENSE' })
  kind: CategoryKind;

  @Column({ type: 'varchar', length: 20, nullable: true })
  code?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
