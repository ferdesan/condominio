import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_STATUSES,
} from './announcement.entity';

export const createAnnouncementSchema = z.object({
  condominiumId: uuidSchema,
  title: z.string().min(3, 'Informe o titulo do comunicado.').max(180),
  content: z.string().min(3, 'Informe o conteudo do comunicado.').max(20000),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('GENERAL'),
  status: z.enum(ANNOUNCEMENT_STATUSES).default('DRAFT'),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('ALL'),
  targetBlockIds: z.array(uuidSchema).max(100).optional().nullable(),
  pinned: z.boolean().default(false),
  publishedAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  attachmentUrl: z.string().url().max(255).optional().nullable(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export type CreateAnnouncementDTO = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementDTO = z.infer<typeof updateAnnouncementSchema>;
