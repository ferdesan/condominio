import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Unit } from '@/modules/units/unit.entity';

export const BLOCK_TYPES = ['BLOCK', 'TOWER', 'WING', 'STREET'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Bloco, torre ou ala de um condominio. */
@Entity('blocks')
@Index(['tenantId', 'condominiumId', 'name'], { unique: true })
export class Block extends TenantScopedEntity {
  @Column({ name: 'condominium_id', type: 'varchar', length: 36 })
  condominiumId: string;

  @ManyToOne(() => Condominium, (condominium) => condominium.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium?: Condominium;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'BLOCK' })
  type: BlockType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'int', default: 1 })
  floors: number;

  @Column({ name: 'units_per_floor', type: 'int', default: 0 })
  unitsPerFloor: number;

  @Column({ name: 'has_elevator', type: 'boolean', default: false })
  hasElevator: boolean;

  @OneToMany(() => Unit, (unit) => unit.block)
  units?: Unit[];
}
