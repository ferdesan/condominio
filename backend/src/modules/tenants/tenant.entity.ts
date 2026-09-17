import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@/shared/entities';

export const TENANT_PLANS = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export type TenantSettings = {
  primaryColor?: string;
  timezone?: string;
  locale?: string;
  /** Dias de tolerancia antes da multa por atraso. */
  chargeGraceDays?: number;
  /** Percentual de multa aplicado sobre cobrancas vencidas. */
  latePenaltyPercent?: number;
  /** Percentual de juros ao mes. */
  lateInterestPercent?: number;
  /** Encarregado de dados (LGPD) e politica de retencao da administradora. */
  lgpd?: {
    dpoName?: string | null;
    dpoEmail?: string | null;
    /** Tempo de retencao dos dados pessoais, em anos. */
    retentionYears?: number | null;
  };
};

/**
 * Raiz do isolamento multi-tenant: cada administradora de condominios e um
 * tenant. Nao estende TenantScopedEntity porque e o proprio escopo.
 */
@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 14, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'TRIAL' })
  plan: TenantPlan;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: TenantStatus;

  @Column({ name: 'max_condominiums', type: 'int', default: 1 })
  maxCondominiums: number;

  @Column({ name: 'max_users', type: 'int', default: 10 })
  maxUsers: number;

  @Column({ name: 'logo_url', type: 'varchar', length: 255, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'trial_ends_at', type: 'datetime', nullable: true })
  trialEndsAt?: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  settings?: TenantSettings | null;
}
