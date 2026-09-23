import { describe, expect, it } from 'vitest';
import { UNIT_VOTE_STATUS_VALUES } from '@/types/assembly';
import {
  POLL_STATUS_LABELS,
  UNIT_VOTE_STATUS_LABELS,
  VOTE_CONFIRMATION,
} from './assembly-labels';

/**
 * UT-145: cobertura do union e ausencia de colisao com o vocabulario ja em uso
 * — valores de `POLL_STATUS_LABELS` e o cabecalho de coluna/filtro "Situação",
 * que e onde a colisao anterior quebrou consulta por texto.
 */
describe('UNIT_VOTE_STATUS_LABELS e a copia de confirmacao', () => {
  it('UT-145: cobre todo o union de status e nao colide com o vocabulario de colunas e filtros', () => {
    for (const value of UNIT_VOTE_STATUS_VALUES) {
      expect(UNIT_VOTE_STATUS_LABELS[value]).toBeTruthy();
    }

    const pollStatusVocabulary = Object.values(POLL_STATUS_LABELS);
    for (const label of Object.values(UNIT_VOTE_STATUS_LABELS)) {
      expect(pollStatusVocabulary).not.toContain(label);
      expect(label).not.toBe('Situação');
    }

    expect(VOTE_CONFIRMATION).toBe('Voto registrado');
    expect(Object.values(UNIT_VOTE_STATUS_LABELS)).not.toContain(VOTE_CONFIRMATION);
  });
});
