import fs from 'node:fs/promises';
import { logger } from '@/config/logger';
import { resolveStoredPath } from '@/middlewares/upload.middleware';
import { hasPermission } from '@/shared/constants/permissions';
import { ROLE_RESIDENT, ROLE_STAFF } from '@/shared/constants/roles';
import { BadRequestError, ForbiddenError } from '@/shared/errors';
import { CondominiumScopedService } from '@/shared/services/condominium-scoped.service';
import { assertCondominiumAccess } from '@/shared/services/reference-guard';
import type { RequestContext } from '@/shared/services/request-context';
import { DocumentFile, type DocumentVisibility } from './document.entity';
import { documentRepository, type DocumentRepository } from './document.repository';
import type { UpdateDocumentDTO, UploadDocumentDTO } from './document.schema';

export type StoredFile = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
};

export class DocumentService extends CondominiumScopedService<
  DocumentFile,
  UploadDocumentDTO,
  UpdateDocumentDTO
> {
  constructor(private readonly documents: DocumentRepository = documentRepository) {
    super(documents, { resource: 'document', label: 'Documento' });
  }

  /** Cria o registro apos o upload ja ter sido persistido em disco pelo multer. */
  async upload(
    ctx: RequestContext,
    dto: UploadDocumentDTO,
    file: StoredFile,
  ): Promise<DocumentFile> {
    await assertCondominiumAccess(ctx.scope, dto.condominiumId);

    const document = await this.documents.create(ctx.scope, {
      ...dto,
      fileName: file.fileName,
      filePath: file.filePath,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: ctx.actor.userId,
      version: 1,
    });

    await this.audit.record({
      tenantId: ctx.scope.tenantId,
      action: 'CREATE',
      resource: 'document',
      resourceId: document.id,
      description: `Upload do documento ${document.title}.`,
      after: { title: document.title, category: document.category, fileName: document.fileName },
      actor: ctx.actor,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return document;
  }

  /** Valida a visibilidade e devolve o caminho absoluto para streaming. */
  async prepareDownload(
    ctx: RequestContext,
    id: string,
  ): Promise<{ absolutePath: string; document: DocumentFile }> {
    const document = await this.findById(ctx, id);
    this.assertVisibility(ctx, document.visibility);

    const absolutePath = resolveStoredPath(document.filePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new BadRequestError('Arquivo indisponivel no armazenamento.');
    }

    await this.documents.incrementDownloads(ctx.scope, id);
    return { absolutePath, document };
  }

  /** Remove o arquivo fisico junto com o registro (LGPD: eliminacao do dado). */
  protected override async afterRemove(_ctx: RequestContext, entity: DocumentFile): Promise<void> {
    try {
      await fs.unlink(resolveStoredPath(entity.filePath));
    } catch (error) {
      logger.warn(`Could not delete file ${entity.filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Regras de visibilidade do portal:
   * PUBLIC/RESIDENTS -> todos; OWNERS -> proprietarios e gestores;
   * STAFF -> funcionarios e gestores; ADMIN -> apenas quem administra documentos.
   */
  private assertVisibility(ctx: RequestContext, visibility: DocumentVisibility): void {
    const isManager = hasPermission(ctx.actor.permissions, 'document:manage');
    if (isManager) return;

    const role = ctx.actor.roleName;

    const allowed: Record<DocumentVisibility, boolean> = {
      PUBLIC: true,
      RESIDENTS: true,
      OWNERS: role !== ROLE_STAFF,
      STAFF: role === ROLE_STAFF,
      ADMIN: false,
    };

    if (!allowed[visibility]) {
      throw new ForbiddenError('Este documento nao esta disponivel para o seu perfil.');
    }

    if (visibility === 'STAFF' && role === ROLE_RESIDENT) {
      throw new ForbiddenError('Este documento nao esta disponivel para o seu perfil.');
    }
  }
}

export const documentService = new DocumentService();
