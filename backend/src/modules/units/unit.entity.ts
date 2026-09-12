import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import {
  TenantScopedEntity,
  numericTransformer,
  preciseNumericTransformer,
} from '@/shared/entities';
import { Block } from '@/modules/blocks/block.entity';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Resident } from '@/modules/residents/resident.entity';

export const UNIT_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'PARKING', 'STORAGE'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = ['OCCUPIED', 'VACANT', 'RENOVATION', 'BLOCKED'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

@Entity('units')
@Index(['tenantId', 'condominiumId'])
@Index(['tenantId', 'blockId', 'number'], { unique: true })
export class Unit extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium?: Condominium;

  @Column({ name: 'block_id', type: 'varchar', length: 36 })
  blockId: string;

  @ManyToOne(() => Block, (block) => block.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block?: Block;

  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ type: 'int', default: 0 })
  floor: number;

  @Column({ type: 'varchar', length: 20, default: 'APARTMENT' })
  type: UnitType;

  @Column({ type: 'varchar', length: 20, default: 'VACANT' })
  status: UnitStatus;

  /** Area privativa em m2. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  area?: number | null;

  /** Fracao ideal usada no rateio das despesas (0-1). */
  @Column({
    name: 'ideal_fraction',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
    transformer: preciseNumericTransformer,
  })
  idealFraction?: number | null;

  /** Valor base da taxa condominial da unidade. */
  @Column({
    name: 'monthly_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  monthlyFee: number;

  @Column({ type: 'int', default: 0 })
  bedrooms: number;

  @Column({ name: 'parking_spots', type: 'int', default: 0 })
  parkingSpots: number;

  @Column({ name: 'pets_allowed', type: 'boolean', default: true })
  petsAllowed: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @OneToMany(() => Resident, (resident) => resident.unit)
  residents?: Resident[];
}
