import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

/** Token de recuperacao de senha, de uso unico e com expiracao curta. */
@Entity('password_reset_tokens')
@Index(['tenantId', 'userId'])
export class PasswordResetToken extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt?: Date | null;
}
