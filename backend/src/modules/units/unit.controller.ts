import type { NextFunction, Request, Response } from 'express';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { created, ok } from '@/shared/http/api-response';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Unit } from './unit.entity';
import type { BulkCreateUnitsDTO, CreateUnitDTO, UpdateUnitDTO } from './unit.schema';
import { unitService, type UnitService } from './unit.service';

export class UnitController extends BaseCrudController<Unit, CreateUnitDTO, UpdateUnitDTO> {
  constructor(private readonly units: UnitService = unitService) {
    super(units);
  }

  bulkCreate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const result = await this.units.bulkCreate(context, req.body as BulkCreateUnitsDTO);
      created(res, result);
    } catch (error) {
      next(error);
    }
  };

  idealFractionSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const condominiumId = String(req.query.condominiumId ?? '');
      ok(res, await this.units.idealFractionSummary(context, condominiumId));
    } catch (error) {
      next(error);
    }
  };
}

export const unitController = new UnitController();
