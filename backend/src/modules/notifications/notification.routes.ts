import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { ok } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { uuidSchema } from '@/shared/dto/common.schema';
import { buildRequestContext } from '@/shared/services/request-context';
import { notificationService } from './notification.service';

export const notificationRouter = Router();

const markAsReadSchema = z.object({
  ids: z.array(uuidSchema).max(200).optional(),
});

/** A central de notificacoes e sempre pessoal: o usuario so ve as proprias. */
notificationRouter.get(
  '/',
  authorize('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const result = await notificationService.list(
        context.scope,
        context.actor.userId,
        parseQueryOptions(req),
      );
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  },
);

notificationRouter.get(
  '/unread-count',
  authorize('notification:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      ok(res, await notificationService.unreadCount(context.scope, context.actor.userId));
    } catch (error) {
      next(error);
    }
  },
);

notificationRouter.post(
  '/read',
  authorize('notification:update'),
  validate({ body: markAsReadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { ids } = req.body as z.infer<typeof markAsReadSchema>;
      ok(res, await notificationService.markAsRead(context.scope, context.actor.userId, ids));
    } catch (error) {
      next(error);
    }
  },
);
