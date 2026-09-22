import { describe, expect, it } from 'vitest';
import { resolveActionUrl } from './notification-links';

/**
 * A excecao DETAIL_PREFIXES (ADR-006) e a subida preservada — as quatro
 * arestas atribuidas a task_02 em `_tests.md`.
 */
describe('resolveActionUrl e a excecao DETAIL_PREFIXES', () => {
  it('UT-135: devolve o path de votacao com id inteiro, sem truncar no modulo', () => {
    expect(resolveActionUrl('/votacoes/poll-abc')).toBe('/votacoes/poll-abc');
  });

  it('UT-136: tira a query do caminho antes de resolver', () => {
    expect(resolveActionUrl('/votacoes/poll-abc?from=push')).toBe('/votacoes/poll-abc');
  });

  it('UT-138: prefixo de votacao sem segmento de id nao e destino', () => {
    expect(resolveActionUrl('/votacoes')).toBeNull();
  });

  it('UT-139: caminho fora de DETAIL_PREFIXES ainda sobe pelos KNOWN_PATHS', () => {
    expect(resolveActionUrl('/reservas/res-1')).toBe('/reservas');
  });
});
