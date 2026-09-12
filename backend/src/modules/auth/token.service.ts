import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/shared/errors';

export type TokenType = 'access' | 'refresh';

export type TokenPayload = {
  /** user id */
  sub: string;
  /** tenant id */
  tid: string;
  /** session id, shared by the access/refresh pair */
  sid: string;
  typ: TokenType;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
};

/**
 * `jwtid` garante que dois tokens emitidos no mesmo segundo para a mesma
 * sessao sejam diferentes — essencial na rotacao do refresh token, cujo hash
 * e unico na base.
 */
function sign(payload: TokenPayload, secret: string, expiresIn: string): string {
  const options = {
    expiresIn,
    issuer: 'condominio-saas',
    jwtid: randomUUID(),
  } as SignOptions;
  return jwt.sign(payload, secret, options);
}

export class TokenService {
  issue(userId: string, tenantId: string, sessionId: string): IssuedTokens {
    const accessToken = sign(
      { sub: userId, tid: tenantId, sid: sessionId, typ: 'access' },
      env.JWT_SECRET,
      env.JWT_EXPIRES_IN,
    );
    const refreshToken = sign(
      { sub: userId, tid: tenantId, sid: sessionId, typ: 'refresh' },
      env.JWT_REFRESH_SECRET,
      env.JWT_REFRESH_EXPIRES_IN,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.decodeTtlSeconds(accessToken),
      tokenType: 'Bearer',
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.verify(token, env.JWT_SECRET, 'access');
  }

  verifyRefreshToken(token: string): TokenPayload {
    return this.verify(token, env.JWT_REFRESH_SECRET, 'refresh');
  }

  private verify(token: string, secret: string, expectedType: TokenType): TokenPayload {
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload & TokenPayload;
      if (decoded.typ !== expectedType) {
        throw new UnauthorizedError('Tipo de token invalido.');
      }
      return { sub: decoded.sub, tid: decoded.tid, sid: decoded.sid, typ: decoded.typ };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expirado.');
      }
      throw new UnauthorizedError('Token invalido.');
    }
  }

  /** Seconds remaining until the access token expires, for the client scheduler. */
  private decodeTtlSeconds(token: string): number {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded?.exp) return 0;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  }
}

export const tokenService = new TokenService();
