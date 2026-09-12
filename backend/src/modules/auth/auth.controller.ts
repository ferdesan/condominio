import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { env, isProduction } from '@/config/env';
import { UnauthorizedError } from '@/shared/errors';
import { created, noContent, ok } from '@/shared/http/api-response';
import { authService, type AuthService, type RequestMeta } from './auth.service';
import type {
  ChangePasswordDTO,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterTenantDTO,
  ResetPasswordDTO,
  UpdateProfileDTO,
} from './auth.schema';

const REFRESH_COOKIE = 'refresh_token';

/**
 * O refresh token trafega em cookie httpOnly (imune a XSS) e tambem e devolvido
 * no corpo para clientes nativos que nao usam cookies.
 */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: `${env.API_PREFIX}/auth`,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  private meta(req: Request): RequestMeta {
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      requestId: req.requestId,
    };
  }

  private extractRefreshToken(req: Request): string | undefined {
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    return fromBody ?? fromCookie;
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body as LoginDTO, this.meta(req));
      res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, refreshCookieOptions());
      ok(res, result);
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.registerTenant(req.body as RegisterTenantDTO, this.meta(req));
      res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, refreshCookieOptions());
      created(res, result);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractRefreshToken(req);
      if (!token) throw new UnauthorizedError('Refresh token nao informado.');

      const result = await this.service.refresh(token, this.meta(req));
      res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, refreshCookieOptions());
      ok(res, result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.auth
        ? { userId: req.auth.userId, tenantId: req.auth.tenantId, name: req.auth.name }
        : undefined;
      await this.service.logout(this.extractRefreshToken(req), this.meta(req), actor);
      res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
      noContent(res);
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthorizedError();
      await this.service.logoutAll(req.auth.userId, req.auth.tenantId);
      res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
      noContent(res);
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthorizedError();
      ok(res, await this.service.me(req.auth.tenantId, req.auth.userId));
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthorizedError();
      const user = await this.service.updateProfile(
        req.auth.tenantId,
        req.auth.userId,
        req.body as UpdateProfileDTO,
      );
      ok(res, user);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthorizedError();
      await this.service.changePassword(
        req.auth.tenantId,
        req.auth.userId,
        req.body as ChangePasswordDTO,
        this.meta(req),
      );
      noContent(res);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.forgotPassword(req.body as ForgotPasswordDTO, this.meta(req));
      res.status(202).json({
        success: true,
        data: {
          message: 'Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.',
          ...result,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resetPassword(req.body as ResetPasswordDTO, this.meta(req));
      noContent(res);
    } catch (error) {
      next(error);
    }
  };

  sessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new UnauthorizedError();
      ok(res, await this.service.listSessions(req.auth.userId));
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
