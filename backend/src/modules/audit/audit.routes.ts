import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidSchema } from '@/shared/dto/common.schema';
import { ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import { auditService } from './audit.service';

export const auditRouter = Router();

/** Trilha de auditoria: somente leitura, nunca editavel pela aplicacao. */
auditRouter.get(
  '/',
  authorize('audit-log:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      page(res, await auditService.list(context.scope, parseQueryOptions(req)));
    } catch (error) {
      next(error);
    }
  },
);

auditRouter.get(
  '/:resource/:resourceId',
  authorize('audit-log:read'),
  validate({ params: z.object({ resource: z.string().max(60), resourceId: uuidSchema }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      ok(
        res,
        await auditService.listByResource(context.scope, req.params.resource, req.params.resourceId),
      );
    } catch (error) {
      next(error);
    }
  },
);
