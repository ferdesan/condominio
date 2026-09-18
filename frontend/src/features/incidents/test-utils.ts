/**
 * Fixtures e duble de transporte dos testes de ocorrencias (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/incident.ts`: aquele arquivo e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada
 * contra o contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { Incident, IncidentAssignee, IncidentSummaryEntry } from '@/types/incident';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'incident-1',
    condominiumId: 'cond-1',
    unitId: 'unit-1',
    protocol: 'OC-2026-000001',
    title: 'Vazamento na garagem',
    description: 'Poca de água embaixo da vaga 14, aumentando desde ontem.',
    category: 'MAINTENANCE',
    priority: 'HIGH',
    status: 'OPEN',
    reportedById: 'user-1',
    reportedByName: 'Carlos Pereira',
    isAnonymous: false,
    assignedToId: null,
    occurredAt: '2026-03-10T11:00:00.000Z',
    resolvedAt: null,
    resolution: null,
    attachments: null,
    location: 'Garagem G1',
    ...TIMESTAMPS,
    ...overrides,
  };
}

/**
 * Usuario elegivel como responsavel.
 *
 * O vinculo com condominios vem embutido na resposta de `/users` — e e sobre ele
 * que o recorte do seletor acontece, ja que o endpoint e por tenant.
 */
export function makeAssignee(overrides: Partial<IncidentAssignee> = {}): IncidentAssignee {
  return {
    id: 'user-2',
    name: 'Joana Ribeiro',
    email: 'joana@exemplo.com',
    status: 'ACTIVE',
    condominiums: [{ id: 'cond-1', name: 'Residencial Aurora' }],
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type IncidentWorld = {
  incidents: Incident[];
  users: IncidentAssignee[];
  /** Corpo de `/incidents/summary`, que e um array de `{ status, total }`. */
  summary: IncidentSummaryEntry[];
  /** Quando definido, `/incidents/summary` falha — sem derrubar a listagem. */
  summaryError?: Error;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as tres rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 */
export function serveIncidents(initial: Partial<IncidentWorld> = {}): IncidentWorld {
  const world: IncidentWorld = {
    incidents: [],
    users: [makeAssignee()],
    summary: [],
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/users') {
      return { data: world.users, meta: makeMeta({ total: world.users.length, perPage: 200 }) };
    }
    if (url !== '/incidents') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.incidents,
      meta: makeMeta({
        total: world.total ?? world.incidents.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/incidents/summary') {
      if (world.summaryError) throw world.summaryError;
      return world.summary as never;
    }
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de ocorrencias pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/incidents');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Consultas feitas ao endpoint de resumo. */
export function summaryRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/incidents/summary')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}
