import { Router, type RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { permission } from '@/shared/constants/permissions';
import type { Resource } from '@/shared/constants/resources';
import { idParamSchema } from '@/shared/dto/common.schema';
/**
 * Contrato minimo que um controller precisa oferecer para ser roteado aqui.
 * Depender dos handlers (e nao da classe generica) mantem a fabrica desacoplada
 * dos tipos de DTO de cada modulo.
 */
export type CrudHandlers = {
  list: RequestHandler;
  show: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  restore: RequestHandler;
};

export type CrudRouterOptions = {
  resource: Resource;
  controller: CrudHandlers;
  createSchema?: ZodTypeAny;
  updateSchema?: ZodTypeAny;
  querySchema?: ZodTypeAny;
  /** Disables individual operations (e.g. read-only resources). */
  disable?: Array<'list' | 'show' | 'create' | 'update' | 'remove' | 'restore'>;
  /**
   * Registers module-specific routes. Invoked *before* the `/:id` routes so
   * literal paths such as `/summary` are not captured by the id parameter.
   */
  extend?: (router: Router) => void;
};

/**
 * Builds the seven conventional REST endpoints for a resource with consistent
 * authorization, validation and response shapes. Modules only provide their
 * schemas and any extra routes — the wiring is identical everywhere.
 */
export function createCrudRouter(options: CrudRouterOptions): Router {
  const router = Router();
  const { resource, controller, disable = [] } = options;
  const enabled = (operation: (typeof disable)[number]) => !disable.includes(operation);

  options.extend?.(router);

  if (enabled('list')) {
    router.get(
      '/',
      authorize(permission(resource, 'read')),
      ...(options.querySchema ? [validate({ query: options.querySchema })] : []),
      controller.list,
    );
  }

  if (enabled('create')) {
    router.post(
      '/',
      authorize(permission(resource, 'create')),
      ...(options.createSchema ? [validate({ body: options.createSchema })] : []),
      controller.create,
    );
  }

  if (enabled('show')) {
    router.get(
      '/:id',
      authorize(permission(resource, 'read')),
      validate({ params: idParamSchema }),
      controller.show,
    );
  }

  if (enabled('update')) {
    const handlers = [
      authorize(permission(resource, 'update')),
      validate({ params: idParamSchema }),
      ...(options.updateSchema ? [validate({ body: options.updateSchema })] : []),
      controller.update,
    ];
    router.patch('/:id', ...handlers);
    router.put('/:id', ...handlers);
  }

  if (enabled('remove')) {
    router.delete(
      '/:id',
      authorize(permission(resource, 'delete')),
      validate({ params: idParamSchema }),
      controller.remove,
    );
  }

  if (enabled('restore')) {
    router.post(
      '/:id/restore',
      authorize(permission(resource, 'update')),
      validate({ params: idParamSchema }),
      controller.restore,
    );
  }

  return router;
}
