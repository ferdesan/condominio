import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { Role } from './role.entity';
import type { CreateRoleDTO, UpdateRoleDTO } from './role.schema';
import { createRoleSchema, updateRoleSchema } from './role.schema';
import { roleService } from './role.service';

export const roleRouter = createCrudRouter({
  resource: 'role',
  controller: new BaseCrudController<Role, CreateRoleDTO, UpdateRoleDTO>(roleService),
  createSchema: createRoleSchema,
  updateSchema: updateRoleSchema,
  extend: (router) => {
    router.get(
      '/permissions',
      authorize('role:read'),
      (_req: Request, res: Response, next: NextFunction) => {
        try {
          ok(res, roleService.catalog());
        } catch (error) {
          next(error);
        }
      },
    );
  },
});
