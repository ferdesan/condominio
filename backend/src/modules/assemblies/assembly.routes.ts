import { Router, type NextFunction, type Request, type Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { ok } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Assembly } from './entities/assembly.entity';
import type { Poll } from './entities/poll.entity';
import {
  castProxyVoteSchema,
  castVoteSchema,
  createAssemblySchema,
  createPollSchema,
  finishAssemblySchema,
  updateAssemblySchema,
  updatePollSchema,
  type CastProxyVoteDTO,
  type CastVoteDTO,
  type CreateAssemblyDTO,
  type CreatePollDTO,
  type FinishAssemblyDTO,
  type UpdateAssemblyDTO,
  type UpdatePollDTO,
} from './schemas/assembly.schema';
import { assemblyService } from './services/assembly.service';
import { pollService } from './services/poll.service';

export const assemblyRouter = Router();

// ---------------------------------------------------------------------------
// Assembleias
// ---------------------------------------------------------------------------

const handle =
  (action: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ok(res, await action(req));
    } catch (error) {
      next(error);
    }
  };

assemblyRouter.use(
  '/',
  createCrudRouter({
    resource: 'assembly',
    controller: new BaseCrudController<Assembly, CreateAssemblyDTO, UpdateAssemblyDTO>(
      assemblyService,
    ),
    createSchema: createAssemblySchema,
    updateSchema: updateAssemblySchema,
    extend: (router) => {
      router.get(
        '/upcoming',
        authorize('assembly:read'),
        handle((req) =>
          assemblyService.upcoming(
            buildRequestContext(req),
            req.query.condominiumId ? String(req.query.condominiumId) : undefined,
          ),
        ),
      );
      router.post(
        '/:id/start',
        authorize('assembly:update'),
        validate({ params: idParamSchema }),
        handle((req) => assemblyService.start(buildRequestContext(req), req.params.id)),
      );
      router.post(
        '/:id/finish',
        authorize('assembly:update'),
        validate({ params: idParamSchema, body: finishAssemblySchema }),
        handle((req) =>
          assemblyService.finish(
            buildRequestContext(req),
            req.params.id,
            req.body as FinishAssemblyDTO,
          ),
        ),
      );
      router.post(
        '/:id/cancel',
        authorize('assembly:update'),
        validate({ params: idParamSchema }),
        handle((req) => assemblyService.cancel(buildRequestContext(req), req.params.id)),
      );
    },
  }),
);

// ---------------------------------------------------------------------------
// Votacoes (montadas em /polls pelo roteador raiz)
// ---------------------------------------------------------------------------

export const pollRouter = createCrudRouter({
  resource: 'poll',
  controller: new BaseCrudController<Poll, CreatePollDTO, UpdatePollDTO>(pollService),
  createSchema: createPollSchema,
  updateSchema: updatePollSchema,
  extend: (router) => {
    router.post(
      '/:id/open',
      authorize('poll:update'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.open(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/close',
      authorize('poll:update'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.close(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/vote',
      authorize('vote:create'),
      validate({ params: idParamSchema, body: castVoteSchema }),
      handle((req) =>
        pollService.castVote(buildRequestContext(req), req.params.id, req.body as CastVoteDTO),
      ),
    );
    router.get(
      '/:id/results',
      authorize('poll:read'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.results(buildRequestContext(req), req.params.id)),
    );
    router.get(
      '/:id/votes',
      authorize('vote:read'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.listVotes(buildRequestContext(req), req.params.id)),
    );
    router.post(
      '/:id/votes',
      authorize('vote:manage'),
      validate({ params: idParamSchema, body: castProxyVoteSchema }),
      handle((req) =>
        pollService.castVoteOnBehalf(
          buildRequestContext(req),
          req.params.id,
          req.body as CastProxyVoteDTO,
        ),
      ),
    );
    router.get(
      '/:id/my-vote',
      authorize('vote:read'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.myVote(buildRequestContext(req), req.params.id)),
    );
    router.get(
      '/:id/vote-status',
      authorize('vote:manage'),
      validate({ params: idParamSchema }),
      handle((req) => pollService.voteStatus(buildRequestContext(req), req.params.id)),
    );
  },
});
