import type { NextFunction, Request, Response } from 'express';
import type { ObjectLiteral } from 'typeorm';
import type { BaseCrudService } from '@/shared/services/base-crud.service';
import { buildRequestContext } from '@/shared/services/request-context';
import { created, noContent, ok, page } from './api-response';
import { parseQueryOptions } from './query-parser';

/**
 * Thin HTTP adapter over a CRUD service. It only translates between Express and
 * the service layer: no business rules live here (Single Responsibility).
 */
export class BaseCrudController<
  T extends ObjectLiteral,
  CreateDTO extends object = Record<string, unknown>,
  UpdateDTO extends object = Partial<CreateDTO>,
> {
  constructor(protected readonly service: BaseCrudService<T, CreateDTO, UpdateDTO>) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const result = await this.service.list(context, parseQueryOptions(req));
      page(res, result);
    } catch (error) {
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const entity = await this.service.findById(context, req.params.id);
      ok(res, entity);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const entity = await this.service.create(context, req.body as CreateDTO);
      created(res, entity);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const entity = await this.service.update(context, req.params.id, req.body as UpdateDTO);
      ok(res, entity);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      await this.service.remove(context, req.params.id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = buildRequestContext(req);
      const entity = await this.service.restore(context, req.params.id);
      ok(res, entity);
    } catch (error) {
      next(error);
    }
  };
}
