import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { BLOCK_TYPES } from './block.entity';

export const createBlockSchema = z.object({
  condominiumId: uuidSchema,
  name: z.string().min(1, 'Informe o nome do bloco.').max(80),
  type: z.enum(BLOCK_TYPES).default('BLOCK'),
  description: z.string().max(255).optional().nullable(),
  floors: z.coerce.number().int().min(1).max(200).default(1),
  unitsPerFloor: z.coerce.number().int().min(0).max(100).default(0),
  hasElevator: z.boolean().default(false),
});

export const updateBlockSchema = createBlockSchema.partial();

export type CreateBlockDTO = z.infer<typeof createBlockSchema>;
export type UpdateBlockDTO = z.infer<typeof updateBlockSchema>;
