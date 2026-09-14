/** Rotulos dos enums de prestador, compartilhados pela listagem, os filtros e o formulario. */

import type { ProviderStatus } from '@/types/api';

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado',
};

/**
 * A escala de avaliacao por extenso. O numero sozinho nao diz de quanto e a nota
 * nem para que lado ela cresce; o rotulo diz as duas coisas.
 */
export const RATING_LABELS: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
};

/** As cinco notas aceitas pelo servidor, na ordem em que o seletor as oferece. */
export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
