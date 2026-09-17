import { Router } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { permission } from '@/shared/constants/permissions';
import { created, ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import { lgpdService } from './lgpd.service';
import {
  createDeleteRequestSchema,
  getConsentQuerySchema,
  lgpdParamsSchema,
  residentParamSchema,
  updateConsentSchema,
  type GetConsentQuery,
} from './lgpd.schema';

export const lgpdRouter = Router();

lgpdRouter.post(
  '/delete-request',
  authorize(permission('lgpd-request', 'create')),
  validate({ body: createDeleteRequestSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.createDeleteRequest(buildRequestContext(req), req.body);
      return created(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.get(
  '/delete-requests',
  authorize(permission('lgpd-request', 'read')),
  async (req, res, next) => {
    try {
      const data = await lgpdService.listDeleteRequests(
        buildRequestContext(req),
        parseQueryOptions(req),
      );
      return page(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.get(
  '/delete-requests/:id',
  authorize(permission('lgpd-request', 'create'), permission('lgpd-request', 'read')),
  validate({ params: lgpdParamsSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.getDeleteRequest(buildRequestContext(req), req.params.id);
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.post(
  '/delete-request/:id/execute',
  authorize(permission('lgpd-request', 'manage')),
  validate({ params: lgpdParamsSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.executeDelete(buildRequestContext(req), req.params.id);
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.post(
  '/delete-request/:id/cancel',
  authorize(permission('lgpd-request', 'create')),
  validate({ params: lgpdParamsSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.cancelDeleteRequest(buildRequestContext(req), req.params.id);
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.get('/export', authorize(permission('resident', 'read')), async (req, res, next) => {
  try {
    const data = await lgpdService.exportResidentData(buildRequestContext(req));
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
});

lgpdRouter.get(
  '/export/:residentId',
  authorize(permission('lgpd-request', 'read')),
  validate({ params: residentParamSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.exportResidentData(buildRequestContext(req), {
        residentId: req.params.residentId,
      });
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.get(
  '/consent',
  authorize(permission('lgpd-consent', 'read')),
  validate({ query: getConsentQuerySchema }),
  async (req, res, next) => {
    try {
      const consentType = (req.query as unknown as GetConsentQuery).consentType;
      const data = await lgpdService.getMyConsent(buildRequestContext(req), consentType);
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);

lgpdRouter.post(
  '/consent',
  authorize(permission('lgpd-consent', 'create')),
  validate({ body: updateConsentSchema }),
  async (req, res, next) => {
    try {
      const data = await lgpdService.updateConsent(buildRequestContext(req), req.body);
      return ok(res, data);
    } catch (error) {
      return next(error);
    }
  },
);
