import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { DOCUMENT_CATEGORIES, DOCUMENT_VISIBILITIES } from './document.entity';

/** Campos enviados junto ao arquivo (multipart: tudo chega como string). */
export const uploadDocumentSchema = z.object({
  condominiumId: uuidSchema,
  title: z.string().min(2, 'Informe o titulo do documento.').max(180),
  description: z.string().max(255).optional().nullable(),
  category: z.enum(DOCUMENT_CATEGORIES).default('OTHER'),
  visibility: z.enum(DOCUMENT_VISIBILITIES).default('RESIDENTS'),
  expiresAt: z.string().date().optional().nullable(),
  tags: z
    .union([z.string(), z.array(z.string().max(40))])
    .transform((value) =>
      typeof value === 'string' ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : value,
    )
    .optional()
    .nullable(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(2).max(180).optional(),
  description: z.string().max(255).optional().nullable(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  visibility: z.enum(DOCUMENT_VISIBILITIES).optional(),
  expiresAt: z.string().date().optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().nullable(),
});

export type UploadDocumentDTO = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentDTO = z.infer<typeof updateDocumentSchema>;
