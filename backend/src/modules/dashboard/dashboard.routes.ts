import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { buildRequestContext } from '@/shared/services/request-context';
import { dashboardService } from './dashboard.service';

export const dashboardRouter = Router();

const condominiumQuery = z.object({
  condominiumId: uuidSchema,
  referenceMonth: z
    .string()
    .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Competencia invalida.')
    .optional(),
  months: z.coerce.number().int().min(1).max(24).optional(),
});

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

dashboardRouter.get(
  '/overview',
  authorize('dashboard:read'),
  validate({ query: condominiumQuery }),
  handle((req) =>
    dashboardService.overview(
      buildRequestContext(req),
      String(req.query.condominiumId),
      req.query.referenceMonth ? String(req.query.referenceMonth) : undefined,
    ),
  ),
);

dashboardRouter.get(
  '/financial-series',
  authorize('dashboard:read'),
  validate({ query: condominiumQuery }),
  handle((req) =>
    dashboardService.financialSeries(
      buildRequestContext(req),
      String(req.query.condominiumId),
      req.query.months ? Number(req.query.months) : undefined,
    ),
  ),
);

dashboardRouter.get(
  '/incidents-by-category',
  authorize('dashboard:read'),
  validate({ query: condominiumQuery }),
  handle((req) =>
    dashboardService.incidentsByCategory(buildRequestContext(req), String(req.query.condominiumId)),
  ),
);

dashboardRouter.get(
  '/expenses-by-category',
  authorize('dashboard:read'),
  validate({ query: condominiumQuery }),
  handle((req) =>
    dashboardService.expensesByCategory(
      buildRequestContext(req),
      String(req.query.condominiumId),
      req.query.referenceMonth ? String(req.query.referenceMonth) : undefined,
    ),
  ),
);

dashboardRouter.get(
  '/recent-activity',
  authorize('dashboard:read'),
  handle((req) => dashboardService.recentActivity(buildRequestContext(req))),
);
