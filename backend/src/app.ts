import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env } from '@/config/env';
import { openApiDocument } from '@/config/swagger';
import { errorHandler, notFoundHandler } from '@/middlewares/error.middleware';
import { globalRateLimiter } from '@/middlewares/rate-limit.middleware';
import { httpLogger, requestId } from '@/middlewares/request-context.middleware';
import { apiRouter } from '@/routes';

/**
 * Monta a aplicacao Express sem abrir sockets: o `server.ts` cuida do ciclo de
 * vida e os testes de integracao montam a mesma instancia via supertest.
 */
export function createApp(): Application {
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Seguranca -----------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // O Swagger UI injeta estilos e scripts inline na propria pagina.
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", ...corsOrigins],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Requisicoes sem Origin (curl, apps nativos, health checks) sao aceitas.
        if (!origin || corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Origem nao permitida pelo CORS.'));
      },
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'RateLimit-Remaining'],
    }),
  );

  // --- Infra de requisicao -------------------------------------------------
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(compression());
  app.use(requestId);
  app.use(httpLogger);
  app.use(env.API_PREFIX, globalRateLimiter);

  // --- Documentacao --------------------------------------------------------
  if (env.SWAGGER_ENABLED) {
    app.get(`${env.API_PREFIX}/docs.json`, (_req: Request, res: Response) => {
      res.json(openApiDocument);
    });
    app.use(
      `${env.API_PREFIX}/docs`,
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, {
        customSiteTitle: `${env.APP_NAME} - API`,
        swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
      }),
    );
  }

  // Nao ha rota estatica para os uploads. Servir o diretorio aqui entregaria
  // qualquer arquivo guardado sem autenticacao — fora do `API_PREFIX`, o
  // `authenticate` nem chega a rodar — e a matriz de visibilidade de
  // `document.service.ts` deixaria de significar alguma coisa. O unico caminho
  // ate um arquivo e `GET /documents/:id/download` (ADR-001).

  // --- API -----------------------------------------------------------------
  app.use(env.API_PREFIX, apiRouter);

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: env.APP_NAME,
        version: '1.0.0',
        docs: env.SWAGGER_ENABLED ? `${env.API_PREFIX}/docs` : null,
        health: `${env.API_PREFIX}/health`,
      },
    });
  });

  // --- Frontend estatico (producao) ----------------------------------------
  if (env.NODE_ENV === 'production') {
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
