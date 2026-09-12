import { IsNull, LessThan, type Repository } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { PasswordResetToken } from './password-reset-token.entity';
import { RefreshToken } from './refresh-token.entity';

/** Persistencia dos artefatos de sessao (refresh e recuperacao de senha). */
export class AuthRepository {
  private get refreshTokens(): Repository<RefreshToken> {
    return AppDataSource.getRepository(RefreshToken);
  }

  private get resetTokens(): Repository<PasswordResetToken> {
    return AppDataSource.getRepository(PasswordResetToken);
  }

  async createRefreshToken(data: {
    tenantId: string;
    userId: string;
    tokenHash: string;
    sessionId: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<RefreshToken> {
    return this.refreshTokens.save(this.refreshTokens.create(data));
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokens.findOne({ where: { tokenHash } });
  }

  async revokeRefreshToken(id: string, replacedById?: string | null): Promise<void> {
    await this.refreshTokens.update(id, { revokedAt: new Date(), replacedById: replacedById ?? null });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.refreshTokens.update({ sessionId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Usado no logout global, na troca de senha e na deteccao de reuso de token. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async listActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokens.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async purgeExpiredRefreshTokens(reference = new Date()): Promise<number> {
    const result = await this.refreshTokens.delete({ expiresAt: LessThan(reference) });
    return result.affected ?? 0;
  }

  async createResetToken(data: {
    tenantId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return this.resetTokens.save(this.resetTokens.create(data));
  }

  async findResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.resetTokens.findOne({ where: { tokenHash } });
  }

  async markResetTokenUsed(id: string): Promise<void> {
    await this.resetTokens.update(id, { usedAt: new Date() });
  }

  async invalidateResetTokens(userId: string): Promise<void> {
    await this.resetTokens.update({ userId, usedAt: IsNull() }, { usedAt: new Date() });
  }
}

export const authRepository = new AuthRepository();
