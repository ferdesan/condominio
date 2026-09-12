import type { NextFunction, Request, Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Announcement } from './announcement.entity';
import type { CreateAnnouncementDTO, UpdateAnnouncementDTO } from './announcement.schema';
import { createAnnouncementSchema, updateAnnouncementSchema } from './announcement.schema';
import { announcementService } from './announcement.service';

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

export const announcementRouter = createCrudRouter({
  resource: 'announcement',
  controller: new BaseCrudController<Announcement, CreateAnnouncementDTO, UpdateAnnouncementDTO>(
    announcementService,
  ),
  createSchema: createAnnouncementSchema,
  updateSchema: updateAnnouncementSchema,
  extend: (router) => {
    router.get(
      '/board',
      authorize('announcement:read'),
      handle((req) =>
        announcementService.board(
          buildRequestContext(req),
          req.query.condominiumId ? String(req.query.condominiumId) : undefined,
        ),
      ),
    );
    router.post(
      '/:id/publish',
      authorize('announcement:update'),
      validate({ params: idParamSchema }),
      handle((req) => announcementService.publish(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/archive',
      authorize('announcement:update'),
      validate({ params: idParamSchema }),
      handle((req) => announcementService.archive(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/read',
      authorize('announcement:read'),
      validate({ params: idParamSchema }),
      handle((req) => announcementService.markAsRead(buildRequestContext(req), req.params.id)),
    );
  },
});
