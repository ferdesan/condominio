/**
 * Fixtures e duble de transporte dos testes de auditoria (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/audit.ts`: aquele arquivo e compartilhado entre
 * as tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada contra o
 * contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { AuditLog } from '@/types/audit';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

/**
 * Entrada da trilha.
 *
 * O padrao e uma alteracao de unidade com dois campos mudados, que e a forma que
 * exercita tudo o que a tela mostra: autor, acao, recurso, descricao e o antes e
 * o depois. As acoes sem alvo — login, permissao negada — sao montadas caso a
 * caso com `resourceId: null`.
 */
export function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    userId: 'user-1',
    userName: 'Marina Alves',
    action: 'UPDATE',
    resource: 'unit',
    resourceId: 'unit-1',
    description: 'Unidade 101 atualizada',
    changes: {
      before: { status: 'VACANT', monthlyFee: 800 },
      after: { status: 'OCCUPIED', monthlyFee: 850 },
    },
    ipAddress: '200.10.0.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-1',
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type AuditWorld = {
  logs: AuditLog[];
  /** Resposta de `/audit-logs/:resource/:resourceId` — array cru, sem `meta`. */
  history: AuditLog[];
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as duas rotas de leitura da trilha a partir de uma unica descricao do
 * mundo. O objeto devolvido e o mesmo que os mocks leem, entao mutar um campo
 * dele muda o que a proxima requisicao ve.
 *
 * Qualquer outra URL falha de proposito: uma chamada inesperada precisa aparecer
 * como erro em vez de resolver para `undefined`.
 */
export function serveAudit(initial: Partial<AuditWorld> = {}): AuditWorld {
  const world: AuditWorld = { logs: [], history: [], ...initial };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;
    if (url !== '/audit-logs') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.logs,
      meta: makeMeta({
        total: world.total ?? world.logs.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (/^\/audit-logs\/[^/]+\/[^/]+$/.test(url)) return world.history as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/audit-logs');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Parametros de toda consulta de leitura feita pela tela, com a URL junto. */
export function allReadRequests(): Array<{ url: string; params: RequestParams }> {
  const paginated = vi
    .mocked(apiGetPaginated)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  const plain = vi
    .mocked(apiGet)
    .mock.calls.map(([url, config]) => ({ url, params: (config?.params ?? {}) as RequestParams }));
  return [...paginated, ...plain];
}

/** As URLs pedidas a `apiGet`, que e por onde passa o historico por registro. */
export function historyRequests(): string[] {
  return vi.mocked(apiGet).mock.calls.map(([url]) => url);
}
