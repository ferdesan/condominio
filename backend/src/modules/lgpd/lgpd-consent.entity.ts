import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Resident } from '@/modules/residents/resident.entity';

export const LGPD_CONSENT_TYPES = ['DATA_PROCESSING'] as const;
export type LgpdConsentType = (typeof LGPD_CONSENT_TYPES)[number];

const booleanTransformer = {
  to: (value?: boolean): number => (value ? 1 : 0),
  from: (value?: number | boolean): boolean => Boolean(value),
};

@Entity('lgpd_consents')
@Unique('UQ_lgpd_consents_resident_type', ['residentId', 'consentType'])
export class LgpdConsent extends TenantScopedEntity {
  @Column({ name: 'resident_id', type: 'varchar', length: 36 })
  residentId: string;

  @ManyToOne(() => Resident)
  @JoinColumn({ name: 'resident_id' })
  resident?: Resident;

  @Column({ name: 'consent_type', type: 'varchar', length: 50, default: 'DATA_PROCESSING' })
  consentType: LgpdConsentType;

  @Column({ type: 'tinyint', default: 0, transformer: booleanTransformer })
  granted: boolean;

  @Column({ name: 'granted_at', type: 'datetime', precision: 6, nullable: true })
  grantedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}
