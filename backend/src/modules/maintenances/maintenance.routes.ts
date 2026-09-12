import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Maintenance } from './maintenance.entity';
import type {
  CompleteMaintenanceDTO,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO,
} from './maintenance.schema';
import {
  completeMaintenanceSchema,
  createMaintenanceSchema,
  updateMaintenanceSchema,
} from './maintenance.schema';
import { maintenanceService } from './maintenance.service';

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

export const maintenanceRouter = createCrudRouter({
  resource: 'maintenance',
  controller: new BaseCrudController<Maintenance, CreateMaintenanceDTO, UpdateMaintenanceDTO>(
    maintenanceService,
  ),
  createSchema: createMaintenanceSchema,
  updateSchema: updateMaintenanceSchema,
  extend: (router) => {
    router.get(
      '/upcoming',
      authorize('maintenance:read'),
      handle((req) =>
        maintenanceService.upcoming(
          buildRequestContext(req),
          req.query.condominiumId ? String(req.query.condominiumId) : undefined,
        ),
      ),
    );
    router.post(
      '/:id/start',
      authorize('maintenance:update'),
      validate({ params: idParamSchema }),
      handle((req) => maintenanceService.start(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/complete',
      authorize('maintenance:update'),
      validate({ params: idParamSchema, body: completeMaintenanceSchema }),
      handle((req) =>
        maintenanceService.complete(
          buildRequestContext(req),
          req.params.id,
          req.body as CompleteMaintenanceDTO,
        ),
      ),
    );
    router.post(
      '/:id/cancel',
      authorize('maintenance:update'),
      validate({ params: idParamSchema }),
      handle((req) => maintenanceService.cancel(buildRequestContext(req), req.params.id)),
    );
  },
});
