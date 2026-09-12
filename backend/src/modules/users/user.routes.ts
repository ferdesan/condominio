import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { User } from './user.entity';
import type { AdminResetPasswordDTO, CreateUserDTO, UpdateUserDTO } from './user.schema';
import { adminResetPasswordSchema, createUserSchema, updateUserSchema } from './user.schema';
import { userService } from './user.service';

const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const result = await userService.resetPassword(
      context,
      req.params.id,
      req.body as AdminResetPasswordDTO,
    );
    ok(res, result);
  } catch (error) {
    next(error);
  }
};

export const userRouter = createCrudRouter({
  resource: 'user',
  controller: new BaseCrudController<User, CreateUserDTO, UpdateUserDTO>(userService),
  createSchema: createUserSchema,
  updateSchema: updateUserSchema,
  extend: (router) => {
    router.post(
      '/:id/reset-password',
      authorize('user:manage'),
      validate({ params: idParamSchema, body: adminResetPasswordSchema }),
      resetPassword,
    );
  },
});
