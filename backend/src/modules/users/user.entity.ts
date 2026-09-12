import { Column, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';
import { Condominium } from '@/modules/condominiums/condominium.entity';
import { Role } from '@/modules/roles/role.entity';

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  locale?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
};

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
@Index(['tenantId', 'status'])
export class User extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  email: string;

  /**
   * Nunca retornado por consultas comuns: apenas o fluxo de autenticacao faz
   * `addSelect` explicito deste campo.
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  document?: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: UserStatus;

  @Column({ name: 'role_id', type: 'varchar', length: 36 })
  roleId: string;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  /**
   * Condominios visiveis para o usuario. Vazio significa "todos do tenant",
   * usado por perfis administrativos.
   */
  @ManyToMany(() => Condominium)
  @JoinTable({
    name: 'user_condominiums',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'condominium_id', referencedColumnName: 'id' },
  })
  condominiums?: Condominium[];

  /** Unidade vinculada quando o usuario e morador. */
  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string | null;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ name: 'email_verified_at', type: 'datetime', nullable: true })
  emailVerifiedAt?: Date | null;

  /** Contador usado pelo bloqueio progressivo de forca bruta. */
  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil?: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  preferences?: UserPreferences | null;

  /** Aceite do termo de privacidade (LGPD). */
  @Column({ name: 'lgpd_consent_at', type: 'datetime', nullable: true })
  lgpdConsentAt?: Date | null;
}
