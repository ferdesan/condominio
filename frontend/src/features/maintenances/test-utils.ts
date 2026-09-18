/**
 * Fixtures e duble de transporte dos testes de manutencoes (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/maintenance.ts`: aquele arquivo e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada
 * contra o contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta, makeServiceProvider } from '@/test/fixtures';
import type { ServiceProvider } from '@/types/api';
import type { Maintenance } from '@/types/maintenance';
import type { User } from '@/types/user';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeMaintenance(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    id: 'maintenance-1',
    condominiumId: 'cond-1',
    title: 'Revisao do elevador social',
    description: 'Revisao semestral obrigatória de cabos, freios e nivelamento.',
    type: 'PREVENTIVE',
    status: 'SCHEDULED',
    recurrence: 'SEMIANNUAL',
    assetName: 'Elevador Social - Torre A',
    serviceProviderId: 'provider-1',
    responsibleId: 'user-2',
    scheduledFor: '2026-04-02T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    nextExecutionAt: '2026-10-02',
    estimatedCost: 1800,
    finalCost: null,
    attachments: null,
    notes: null,
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
export function makeMaintenanceUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-2',
    name: 'Joana Ribeiro',
    email: 'joana@exemplo.com',
    phone: '11955554444',
    document: null,
    avatarUrl: null,
    status: 'ACTIVE',
    roleId: 'role-2',
    role: null,
    condominiums: [{ id: 'cond-1', name: 'Residencial Aurora' }],
    unitId: null,
    lastLoginAt: null,
    mustChangePassword: false,
    emailVerifiedAt: null,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type MaintenanceWorld = {
  maintenances: Maintenance[];
  providers: ServiceProvider[];
  users: User[];
  /** Corpo de `/maintenances/upcoming`, que e um array de ordens — sem `meta`. */
  upcoming: Maintenance[];
  /** Quando definido, `/maintenances/upcoming` falha — sem derrubar a listagem. */
  upcomingError?: Error;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as tres rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 *
 * `upcoming` nasce vazio de proposito: os titulos das ordens se repetiriam entre
 * o destaque e a tabela, e uma consulta por texto nao saberia de qual das duas
 * apresentacoes se trata. Os casos que exercitam o destaque o preenchem.
 */
export function serveMaintenances(initial: Partial<MaintenanceWorld> = {}): MaintenanceWorld {
  const world: MaintenanceWorld = {
    maintenances: [],
    providers: [makeServiceProvider()],
    users: [makeMaintenanceUser()],
    upcoming: [],
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/users') {
      return { data: world.users, meta: makeMeta({ total: world.users.length, perPage: 200 }) };
    }
    if (url === '/service-providers') {
      return {
        data: world.providers,
        meta: makeMeta({ total: world.providers.length, perPage: 200 }),
      };
    }
    if (url !== '/maintenances') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.maintenances,
      meta: makeMeta({
        total: world.total ?? world.maintenances.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/maintenances/upcoming') {
      if (world.upcomingError) throw world.upcomingError;
      return world.upcoming as never;
    }
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de manutencoes pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/maintenances');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Consultas feitas ao endpoint do que esta por vir. */
export function upcomingRequests(): RequestParams[] {
  return vi
    .mocked(apiGet)
    .mock.calls.filter(([url]) => url === '/maintenances/upcoming')
    .map(([, config]) => (config?.params ?? {}) as RequestParams);
}
