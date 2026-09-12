import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { ok } from '@/shared/http/api-response';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Correspondence } from './correspondence.entity';
import type {
  CreateCorrespondenceDTO,
  DeliverCorrespondenceDTO,
  UpdateCorrespondenceDTO,
} from './correspondence.schema';
import {
  createCorrespondenceSchema,
  deliverCorrespondenceSchema,
  updateCorrespondenceSchema,
} from './correspondence.schema';
import { correspondenceService } from './correspondence.service';

const deliver = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const result = await correspondenceService.deliver(
      context,
      req.params.id,
      req.body as DeliverCorrespondenceDTO,
    );
    ok(res, result);
  } catch (error) {
    next(error);
  }
};

const pendingCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const condominiumId = req.query.condominiumId ? String(req.query.condominiumId) : undefined;
    ok(res, await correspondenceService.pendingCount(context, condominiumId));
  } catch (error) {
    next(error);
  }
};

export const correspondenceRouter = createCrudRouter({
  resource: 'correspondence',
  controller: new BaseCrudController<
    Correspondence,
    CreateCorrespondenceDTO,
    UpdateCorrespondenceDTO
  >(correspondenceService),
  createSchema: createCorrespondenceSchema,
  updateSchema: updateCorrespondenceSchema,
  extend: (router) => {
    router.get('/pending-count', authorize('correspondence:read'), pendingCount);
    router.post(
      '/:id/deliver',
      authorize('correspondence:update'),
      validate({ params: idParamSchema, body: deliverCorrespondenceSchema }),
      deliver,
    );
  },
});
