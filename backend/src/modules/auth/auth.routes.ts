import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { authRateLimiter } from '@/middlewares/rate-limit.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerTenantSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schema';

export const authRouter = Router();

// Rotas publicas: protegidas por rate limit dedicado contra forca bruta.
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerTenantSchema }),
  authController.register,
);
authRouter.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);
authRouter.post('/logout', authController.logout);

// Rotas autenticadas.
authRouter.get('/me', authenticate, authController.me);
authRouter.patch(
  '/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  authController.updateProfile,
);
authRouter.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
authRouter.get('/sessions', authenticate, authController.sessions);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
