import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity, numericTransformer } from '@/shared/entities';

export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_CONTRACT_TYPES = ['CLT', 'PJ', 'TEMPORARY', 'OUTSOURCED'] as const;
export type EmployeeContractType = (typeof EMPLOYEE_CONTRACT_TYPES)[number];

/** Funcionario do condominio (portaria, limpeza, manutencao, administracao). */
@Entity('employees')
@Index(['tenantId', 'condominiumId'])
export class Employee extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  document?: string | null;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string | null;

  @Column({ name: 'contract_type', type: 'varchar', length: 20, default: 'CLT' })
  contractType: EmployeeContractType;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: EmployeeStatus;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ name: 'admission_date', type: 'date', nullable: true })
  admissionDate?: string | null;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate?: string | null;

  /** Escala de trabalho, ex.: 12x36 noturno. */
  @Column({ name: 'work_schedule', type: 'varchar', length: 120, nullable: true })
  workSchedule?: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  salary?: number | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
