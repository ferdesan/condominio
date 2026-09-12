import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { ok } from '@/shared/http/api-response';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Resident } from './resident.entity';
import type { CreateResidentDTO, UpdateResidentDTO } from './resident.schema';
import { createResidentSchema, updateResidentSchema } from './resident.schema';
import { residentService } from './resident.service';

export const residentController = new BaseCrudController<
  Resident,
  CreateResidentDTO,
  UpdateResidentDTO
>(residentService);

const myUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ok(res, await residentService.myUnitResidents(buildRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

export const residentRouter = createCrudRouter({
  resource: 'resident',
  controller: residentController,
  createSchema: createResidentSchema,
  updateSchema: updateResidentSchema,
  extend: (router) => {
    router.get('/my-unit', authorize('resident:read'), myUnit);
  },
});
