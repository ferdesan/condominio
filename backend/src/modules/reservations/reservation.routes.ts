import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { ok } from '@/shared/http/api-response';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Reservation } from './reservation.entity';
import type {
  AvailabilityQuery,
  CreateReservationDTO,
  ReviewReservationDTO,
  UpdateReservationDTO,
} from './reservation.schema';
import {
  availabilityQuerySchema,
  createReservationSchema,
  reviewReservationSchema,
  updateReservationSchema,
} from './reservation.schema';
import { reservationService } from './reservation.service';

type ReviewAction = 'approve' | 'reject' | 'cancel';

const review =
  (action: ReviewAction) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const dto = req.body as ReviewReservationDTO;
      const result = await reservationService[action](context, req.params.id, dto);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  };

const availability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await reservationService.availability(context, req.query as unknown as AvailabilityQuery));
  } catch (error) {
    next(error);
  }
};

export const reservationRouter = createCrudRouter({
  resource: 'reservation',
  controller: new BaseCrudController<Reservation, CreateReservationDTO, UpdateReservationDTO>(
    reservationService,
  ),
  createSchema: createReservationSchema,
  updateSchema: updateReservationSchema,
  extend: (router) => {
    router.get(
      '/availability',
      authorize('reservation:read'),
      validate({ query: availabilityQuerySchema }),
      availability,
    );
    router.post(
      '/:id/approve',
      authorize('reservation:manage'),
      validate({ params: idParamSchema, body: reviewReservationSchema }),
      review('approve'),
    );
    router.post(
      '/:id/reject',
      authorize('reservation:manage'),
      validate({ params: idParamSchema, body: reviewReservationSchema }),
      review('reject'),
    );
    router.post(
      '/:id/cancel',
      authorize('reservation:update'),
      validate({ params: idParamSchema, body: reviewReservationSchema }),
      review('cancel'),
    );
  },
});
