import type { NextFunction, Request, Response } from 'express';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { ok } from '@/shared/http/api-response';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Condominium } from './condominium.entity';
import { condominiumService, type CondominiumService } from './condominium.service';
import type { CreateCondominiumDTO, UpdateCondominiumDTO } from './condominium.schema';

export class CondominiumController extends BaseCrudController<
  Condominium,
  CreateCondominiumDTO,
  UpdateCondominiumDTO
> {
  constructor(private readonly condominiums: CondominiumService = condominiumService) {
    super(condominiums);
  }

  stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      ok(res, await this.condominiums.stats(context, req.params.id));
    } catch (error) {
      next(error);
    }
  };
}

export const condominiumController = new CondominiumController();
