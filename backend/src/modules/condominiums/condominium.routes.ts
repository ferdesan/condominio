import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { createCrudRouter } from '@/shared/http/crud-router';
import { condominiumController } from './condominium.controller';
import {
  createCondominiumSchema,
  updateCondominiumSchema,
} from './condominium.schema';

export const condominiumRouter = createCrudRouter({
  resource: 'condominium',
  controller: condominiumController,
  createSchema: createCondominiumSchema,
  updateSchema: updateCondominiumSchema,
  extend: (router) => {
    router.get(
      '/:id/stats',
      authorize('condominium:read'),
      validate({ params: idParamSchema }),
      condominiumController.stats,
    );
  },
});
