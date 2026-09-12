import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { ok } from '@/shared/http/api-response';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Visitor } from './visitor.entity';
import type {
  CheckInDTO,
  CheckOutDTO,
  CreateVisitorDTO,
  UpdateVisitorDTO,
} from './visitor.schema';
import {
  checkInSchema,
  checkOutSchema,
  createVisitorSchema,
  updateVisitorSchema,
} from './visitor.schema';
import { visitorService } from './visitor.service';

const checkIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await visitorService.checkIn(context, req.params.id, req.body as CheckInDTO));
  } catch (error) {
    next(error);
  }
};

const checkOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await visitorService.checkOut(context, req.params.id, req.body as CheckOutDTO));
  } catch (error) {
    next(error);
  }
};

const byAccessCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await visitorService.findByAccessCode(context, String(req.params.code)));
  } catch (error) {
    next(error);
  }
};

const insideCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const condominiumId = req.query.condominiumId ? String(req.query.condominiumId) : undefined;
    ok(res, await visitorService.insideCount(context, condominiumId));
  } catch (error) {
    next(error);
  }
};

export const visitorRouter = createCrudRouter({
  resource: 'visitor',
  controller: new BaseCrudController<Visitor, CreateVisitorDTO, UpdateVisitorDTO>(visitorService),
  createSchema: createVisitorSchema,
  updateSchema: updateVisitorSchema,
  extend: (router) => {
    router.get('/inside-count', authorize('visitor:read'), insideCount);
    router.get(
      '/access-code/:code',
      authorize('visitor:read'),
      validate({ params: z.object({ code: z.string().min(4).max(12) }) }),
      byAccessCode,
    );
    router.post(
      '/:id/check-in',
      authorize('visitor:update'),
      validate({ params: idParamSchema, body: checkInSchema }),
      checkIn,
    );
    router.post(
      '/:id/check-out',
      authorize('visitor:update'),
      validate({ params: idParamSchema, body: checkOutSchema }),
      checkOut,
    );
  },
});
