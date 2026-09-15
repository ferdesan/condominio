import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { authorize } from '@/middlewares/auth.middleware';
import { toStoredPath, upload } from '@/middlewares/upload.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/shared/dto/common.schema';
import { BadRequestError } from '@/shared/errors';
import { created, noContent, ok, page } from '@/shared/http/api-response';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import { documentService } from './document.service';
import {
  updateDocumentSchema,
  uploadDocumentSchema,
  type UpdateDocumentDTO,
} from './document.schema';

export const documentRouter = Router();

documentRouter.get(
  '/',
  authorize('document:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      page(res, await documentService.list(context, parseQueryOptions(req)));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Upload multipart. O arquivo e gravado pelo multer em `uploads/<tenant>/` e o
 * corpo e validado depois, ja com os campos textuais do formulario.
 */
documentRouter.post(
  '/',
  authorize('document:create'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new BadRequestError('Envie o arquivo no campo "file".');

      const context = buildRequestContext(req);
      const dto = uploadDocumentSchema.parse(req.body);

      const document = await documentService.upload(context, dto, {
        fileName: req.file.originalname,
        filePath: toStoredPath(req.file),
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });

      created(res, document);
    } catch (error) {
      // O multer grava o arquivo antes de a validacao do corpo rodar, e
      // `documentService.upload` tambem pode recusar depois disso. Sem esta
      // limpeza, toda falha daqui deixa um arquivo no disco para sempre, sem
      // registro que o alcance. A falha do unlink e engolida de proposito: ela
      // nunca pode substituir o erro que o cliente precisa receber.
      if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
      next(error);
    }
  },
);

documentRouter.get(
  '/:id',
  authorize('document:read'),
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      ok(res, await documentService.findById(context, req.params.id));
    } catch (error) {
      next(error);
    }
  },
);

documentRouter.get(
  '/:id/download',
  authorize('document:read'),
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      const { absolutePath, document } = await documentService.prepareDownload(
        context,
        req.params.id,
      );

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(path.basename(document.fileName))}"`,
      );
      res.sendFile(absolutePath, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  },
);

documentRouter.patch(
  '/:id',
  authorize('document:update'),
  validate({ params: idParamSchema, body: updateDocumentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      ok(res, await documentService.update(context, req.params.id, req.body as UpdateDocumentDTO));
    } catch (error) {
      next(error);
    }
  },
);

documentRouter.delete(
  '/:id',
  authorize('document:delete'),
  validate({ params: idParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      await documentService.remove(context, req.params.id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },
);
