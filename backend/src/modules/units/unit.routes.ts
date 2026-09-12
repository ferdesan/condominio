import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidSchema } from '@/shared/dto/common.schema';
import { createCrudRouter } from '@/shared/http/crud-router';
import { unitController } from './unit.controller';
import { bulkCreateUnitsSchema, createUnitSchema, updateUnitSchema } from './unit.schema';

export const unitRouter = createCrudRouter({
  resource: 'unit',
  controller: unitController,
  createSchema: createUnitSchema,
  updateSchema: updateUnitSchema,
  extend: (router) => {
    router.post(
      '/bulk',
      authorize('unit:create'),
      validate({ body: bulkCreateUnitsSchema }),
      unitController.bulkCreate,
    );
    router.get(
      '/ideal-fraction',
      authorize('unit:read'),
      validate({ query: z.object({ condominiumId: uuidSchema }) }),
      unitController.idealFractionSummary,
    );
  },
});
