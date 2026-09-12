import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Unit } from '@/modules/units/unit.entity';
import { Dependent } from '@/modules/dependents/dependent.entity';

export const RESIDENT_TYPES = ['OWNER', 'TENANT', 'OCCUPANT'] as const;
export type ResidentType = (typeof RESIDENT_TYPES)[number];

export const RESIDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'MOVED_OUT'] as const;
export type ResidentStatus = (typeof RESIDENT_STATUSES)[number];

/** Morador da unidade: proprietario, locatario ou ocupante autorizado. */
@Entity('residents')
@Index(['tenantId', 'condominiumId'])
@Index(['tenantId', 'document'])
export class Resident extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @ManyToOne(() => Unit, (unit) => unit.residents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  /** Conta de acesso vinculada, quando o morador usa o portal. */
  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OWNER' })
  type: ResidentType;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: ResidentStatus;

  /** Responsavel principal pela unidade (recebe cobrancas e comunicados). */
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'move_in_date', type: 'date', nullable: true })
  moveInDate?: string | null;

  @Column({ name: 'move_out_date', type: 'date', nullable: true })
  moveOutDate?: string | null;

  @Column({ name: 'emergency_contact', type: 'varchar', length: 150, nullable: true })
  emergencyContact?: string | null;

  @Column({ name: 'emergency_phone', type: 'varchar', length: 20, nullable: true })
  emergencyPhone?: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  /** Data do aceite do termo de tratamento de dados (LGPD art. 8). */
  @Column({ name: 'lgpd_consent_at', type: 'datetime', nullable: true })
  lgpdConsentAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @OneToMany(() => Dependent, (dependent) => dependent.resident)
  dependents?: Dependent[];
}
