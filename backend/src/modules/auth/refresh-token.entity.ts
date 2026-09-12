import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '@/shared/entities';

/**
 * Refresh token persistido como hash SHA-256 com rotacao: cada uso invalida o
 * token anterior e registra o sucessor, permitindo detectar reuso (roubo de token).
 */
@Entity('refresh_tokens')
@Index(['tenantId', 'userId'])
export class RefreshToken extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'replaced_by_id', type: 'varchar', length: 36, nullable: true })
  replacedById?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;
}
