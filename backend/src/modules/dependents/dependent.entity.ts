import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Resident } from '@/modules/residents/resident.entity';

export const DEPENDENT_RELATIONSHIPS = [
  'SPOUSE',
  'CHILD',
  'PARENT',
  'SIBLING',
  'EMPLOYEE',
  'OTHER',
] as const;
export type DependentRelationship = (typeof DEPENDENT_RELATIONSHIPS)[number];

/** Dependente vinculado a um morador (filhos, conjuge, empregado domestico). */
@Entity('dependents')
@Index(['tenantId', 'residentId'])
export class Dependent extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36 })
  unitId: string;

  @Column({ name: 'resident_id', type: 'varchar', length: 36 })
  residentId: string;

  @ManyToOne(() => Resident, (resident) => resident.dependents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident?: Resident;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'OTHER' })
  relationship: DependentRelationship;

  @Column({ type: 'varchar', length: 11, nullable: true })
  document?: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ name: 'has_access_card', type: 'boolean', default: false })
  hasAccessCard: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
