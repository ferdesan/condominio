import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema, uuidSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Incident } from './incident.entity';
import type {
  AssignIncidentDTO,
  ChangeIncidentStatusDTO,
  CreateIncidentDTO,
  UpdateIncidentDTO,
} from './incident.schema';
import {
  assignIncidentSchema,
  changeStatusSchema,
  createIncidentSchema,
  updateIncidentSchema,
} from './incident.schema';
import { incidentService } from './incident.service';

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

export const incidentRouter = createCrudRouter({
  resource: 'incident',
  controller: new BaseCrudController<Incident, CreateIncidentDTO, UpdateIncidentDTO>(
    incidentService,
  ),
  createSchema: createIncidentSchema,
  updateSchema: updateIncidentSchema,
  extend: (router) => {
    router.get(
      '/summary',
      authorize('incident:read'),
      validate({ query: z.object({ condominiumId: uuidSchema }) }),
      handle((req) =>
        incidentService.statusSummary(buildRequestContext(req), String(req.query.condominiumId)),
      ),
    );
    router.post(
      '/:id/status',
      authorize('incident:update'),
      validate({ params: idParamSchema, body: changeStatusSchema }),
      handle((req) =>
        incidentService.changeStatus(
          buildRequestContext(req),
          req.params.id,
          req.body as ChangeIncidentStatusDTO,
        ),
      ),
    );
    router.post(
      '/:id/assign',
      authorize('incident:manage'),
      validate({ params: idParamSchema, body: assignIncidentSchema }),
      handle((req) =>
        incidentService.assign(
          buildRequestContext(req),
          req.params.id,
          req.body as AssignIncidentDTO,
        ),
      ),
    );
  },
});
