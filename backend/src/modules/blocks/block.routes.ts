import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import type { Block } from './block.entity';
import type { CreateBlockDTO, UpdateBlockDTO } from './block.schema';
import { createBlockSchema, updateBlockSchema } from './block.schema';
import { blockService } from './block.service';

export const blockController = new BaseCrudController<Block, CreateBlockDTO, UpdateBlockDTO>(
  blockService,
);

export const blockRouter = createCrudRouter({
  resource: 'block',
  controller: blockController,
  createSchema: createBlockSchema,
  updateSchema: updateBlockSchema,
});
