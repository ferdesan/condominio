import { Router, type NextFunction, type Request, type Response } from 'express';
import { authorize, requireSuperAdmin } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { noContent, ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import { createTenantSchema, updateTenantSchema, type UpdateTenantDTO } from './tenant.schema';
import { tenantService } from './tenant.service';

export const tenantRouter = Router();

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

/** Contexto da administradora do usuario logado (usado pelo frontend). */
tenantRouter.get(
  '/me',
  authorize('tenant:read'),
  handle((req) => tenantService.current(buildRequestContext(req))),
);

tenantRouter.patch(
  '/me',
  authorize('tenant:update'),
  validate({ body: updateTenantSchema }),
  handle((req) => {
    const context = buildRequestContext(req);
    return tenantService.update(context, context.scope.tenantId, req.body as UpdateTenantDTO);
  }),
);

tenantRouter.get('/', requireSuperAdmin, async (req, res, next) => {
  try {
    const context = buildRequestContext(req);
    page(res, await tenantService.list(context, parseQueryOptions(req)));
  } catch (error) {
    next(error);
  }
});

tenantRouter.post(
  '/',
  requireSuperAdmin,
  validate({ body: createTenantSchema }),
  async (req, res, next) => {
    try {
      const context = buildRequestContext(req);
      res.status(201).json({ success: true, data: await tenantService.create(context, req.body) });
    } catch (error) {
      next(error);
    }
  },
);

tenantRouter.get(
  '/:id',
  authorize('tenant:read'),
  validate({ params: idParamSchema }),
  handle((req) => tenantService.findById(buildRequestContext(req), req.params.id)),
);

tenantRouter.patch(
  '/:id',
  authorize('tenant:update'),
  validate({ params: idParamSchema, body: updateTenantSchema }),
  handle((req) =>
    tenantService.update(buildRequestContext(req), req.params.id, req.body as UpdateTenantDTO),
  ),
);

tenantRouter.delete(
  '/:id',
  requireSuperAdmin,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      await tenantService.remove(buildRequestContext(req), req.params.id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },
);
