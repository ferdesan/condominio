import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import type { Permission } from '@/shared/constants/permissions';

/**
 * Papel de acesso. Os cinco papeis do sistema (`isSystem = true`) sao semeados
 * para cada tenant e nao podem ser removidos; tenants podem criar papeis
 * adicionais combinando permissoes do catalogo.
 */
@Entity('roles')
@Index(['tenantId', 'name'], { unique: true })
export class Role extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null;

  @Column({ type: 'simple-json' })
  permissions: Permission[];

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;
}
