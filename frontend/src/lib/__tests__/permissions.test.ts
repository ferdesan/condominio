/**
 * UT-025 — `hasPermission`/`hasAnyPermission`.
 *
 * A resolucao precisa espelhar a do backend (`backend/src/shared/constants/roles.ts`):
 * `*` libera tudo, `<recurso>:manage` libera qualquer acao sobre o recurso. E o
 * contrato que o menu e o guarda de rota usam para dizer o que a API aceitara.
 */
import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasPermission } from '../permissions';

describe('hasPermission (UT-025)', () => {
  it('UT-025: concede a permissao pedida quando ela esta na lista', () => {
    expect(hasPermission(['resident:read'], 'resident:read')).toBe(true);
  });

  it('UT-025.E1: nega a ação que não esta na lista', () => {
    expect(hasPermission(['resident:read'], 'resident:delete')).toBe(false);
  });

  it('UT-025.E2: o wildcard libera qualquer permissao', () => {
    expect(hasPermission(['*'], 'resident:delete')).toBe(true);
    expect(hasPermission(['*'], 'financial-category:manage')).toBe(true);
  });

  it('UT-025.E3: manage libera o create do recurso', () => {
    expect(hasPermission(['resident:manage'], 'resident:create')).toBe(true);
  });

  it('UT-025.E4: manage libera o read do recurso', () => {
    expect(hasPermission(['resident:manage'], 'resident:read')).toBe(true);
  });

  it('UT-025.E5: lista vazia nega qualquer permissao', () => {
    expect(hasPermission([], 'resident:read')).toBe(false);
  });

  it('UT-025.E6: permissao ausente (undefined/null) nega qualquer pedido', () => {
    expect(hasPermission(undefined, 'resident:read')).toBe(false);
    expect(hasPermission(null, 'resident:read')).toBe(false);
  });

  it('UT-025.E7: sem permissao pedida, qualquer lista concede', () => {
    expect(hasPermission(['*'], undefined)).toBe(true);
  });
});

describe('hasAnyPermission (UT-025)', () => {
  it('UT-025.E8: satisfaz quando alguma das pedidas existe', () => {
    expect(hasAnyPermission(['resident:read'], ['resident:read', 'resident:delete'])).toBe(true);
  });

  it('UT-025.E9: nega quando nenhuma das pedidas existe', () => {
    expect(hasAnyPermission(['vehicle:read'], ['resident:read', 'resident:delete'])).toBe(false);
  });

  it('UT-025.E10: sem pedido nenhum, concede', () => {
    expect(hasAnyPermission([], [])).toBe(true);
    expect(hasAnyPermission(undefined, [])).toBe(true);
  });
});
