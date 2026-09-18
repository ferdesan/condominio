import { Router, type NextFunction, type Request, type Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import {
  closingListQuerySchema,
  closingMonthParamsSchema,
  closingQuerySchema,
  type ClosingQuery,
} from './schemas/financial.schema';
import { closingService } from './services/closing.service';

/**
 * Balancete mensal. `Router` comum, e nao `createCrudRouter`: nao ha CRUD aqui —
 * o mes nao e criado nem excluido, ele e lido e, na task seguinte, fechado.
 */
export const closingRouter = Router();

closingRouter.get(
  '/',
  authorize('financial-closing:read'),
  validate({ query: closingListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      page(res, await closingService.list(context, parseQueryOptions(req)));
    } catch (error) {
      next(error);
    }
  },
);

closingRouter.get(
  '/:referenceMonth',
  authorize('financial-closing:read'),
  validate({ params: closingMonthParamsSchema, query: closingQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { condominiumId } = req.query as unknown as ClosingQuery;
      ok(res, await closingService.statement(context, condominiumId, req.params.referenceMonth));
    } catch (error) {
      next(error);
    }
  },
);
