/**
 * Camada de dados de blocos: a fabrica do ADR-008, sem endpoint proprio.
 *
 * Blocos nasceram dentro de unidades porque nao tinham rota (ADR-007). Agora
 * tem uma, e a gestao embutida no cadastro de unidades continua existindo — as
 * duas leem daqui, entao ha um unico dono da chave de cache e da invalidacao.
 */

import { createResourceHooks } from '@/lib/crud';
import type { Block } from '@/types/api';
import { UNITS_KEY } from '../units/unit-hooks';
import type { BlockPayload } from './block-schema';

export const BLOCKS_KEY = ['blocks'] as const;

/**
 * Toda mutacao de bloco invalida tambem as unidades: a listagem de unidades
 * exibe o nome do bloco vindo do eager load, entao renomear um bloco muda
 * linhas que o cache de unidades ja tem guardadas.
 */
export const blockHooks = createResourceHooks<Block, BlockPayload, Partial<BlockPayload>>(
  'blocks',
  {
    extraInvalidate: [UNITS_KEY],
  },
);
