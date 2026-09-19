import { Router, type NextFunction, type Request, type Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import {
  closingBodySchema,
  closingEntriesQuerySchema,
  closingListQuerySchema,
  closingMonthParamsSchema,
  closingQuerySchema,
  type ClosingEntriesQuery,
  type ClosingQuery,
} from './schemas/financial.schema';
import { closingService } from './services/closing.service';

/**
 * Balancete mensal. `Router` comum, e nao `createCrudRouter`: nao ha CRUD aqui —
 * o mes nao e criado nem excluido, ele e lido e, na task seguinte, fechado.
 */
export const closingRouter = Router();

closingRouter.get(
  '/',
  authorize('financial-closing:read'),
  validate({ query: closingListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      page(res, await closingService.list(context, parseQueryOptions(req)));
    } catch (error) {
      next(error);
    }
  },
);

closingRouter.get(
  '/:referenceMonth',
  authorize('financial-closing:read'),
  validate({ params: closingMonthParamsSchema, query: closingQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { condominiumId } = req.query as unknown as ClosingQuery;
      ok(res, await closingService.statement(context, condominiumId, req.params.referenceMonth));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Os lancamentos da competencia, o mes inteiro numa resposta so (ADR-004).
 *
 * Exige `financial-closing:read`, e nao a permissao de cobranca: quem le
 * cobrancas sem ler a prestacao de contas nao chega ao documento nem digitando
 * o endereco.
 *
 * Convive com `/:referenceMonth` sem ambiguidade — o Express casa pelo caminho
 * inteiro, e `/:referenceMonth` cobre um segmento so.
 */
closingRouter.get(
  '/:referenceMonth/entries',
  authorize('financial-closing:read'),
  validate({ params: closingMonthParamsSchema, query: closingEntriesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { condominiumId } = req.query as unknown as ClosingEntriesQuery;
      ok(res, await closingService.entries(context, condominiumId, req.params.referenceMonth));
    } catch (error) {
      next(error);
    }
  },
);

closingRouter.post(
  '/:referenceMonth/close',
  authorize('financial-closing:create'),
  validate({ params: closingMonthParamsSchema, body: closingBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { condominiumId } = req.body as ClosingQuery;
      ok(res, await closingService.close(context, condominiumId, req.params.referenceMonth));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Reabrir exige `manage`, e nao `create`: `hasPermission` trata `manage` como
 * curinga do recurso, entao quem so tem `create` fecha e nao desfaz. Fechar e
 * rotina mensal; desfazer uma prestacao de contas ja publicada nao e.
 */
closingRouter.post(
  '/:referenceMonth/reopen',
  authorize('financial-closing:manage'),
  validate({ params: closingMonthParamsSchema, body: closingBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { condominiumId } = req.body as ClosingQuery;
      ok(res, await closingService.reopen(context, condominiumId, req.params.referenceMonth));
    } catch (error) {
      next(error);
    }
  },
);
