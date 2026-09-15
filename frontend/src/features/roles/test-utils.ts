/**
 * Fixtures e dubles dos papeis de acesso.
 *
 * Modulo proprio pelo motivo de sempre: uma funcao exportada ao lado de um
 * componente levanta `react-refresh/only-export-components`. A fixture nao mora
 * em `test/fixtures.ts` porque aquele arquivo so conhece `types/api.ts`, que
 * esta fechado para contratos novos.
 */

import { vi } from 'vitest';
import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { Role } from '@/types/role';

const TIMESTAMPS = {
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'SINDICO',
    description: 'Gestao operacional e financeira do condominio.',
    permissions: ['condominium:read', 'reservation:manage', 'charge:read'],
    isSystem: true,
    ...TIMESTAMPS,
    ...overrides,
  };
}

/**
 * Um catalogo reduzido, com a forma do real.
 *
 * O catalogo do servidor tem cento e quarenta e cinco entradas mais o curinga;
 * repeti-las aqui nao afirmaria nada a mais e tornaria cada caso ilegivel. O que
 * importa e a **forma** — `*` na frente, depois o produto de recursos por acoes
 * — e que a tela monte a matriz a partir do que chegou, e nao de uma lista
 * propria.
 */
export const CATALOG: string[] = [
  '*',
  ...['condominium', 'reservation', 'charge', 'role'].flatMap((resource) =>
    ['create', 'read', 'update', 'delete', 'manage'].map((action) => `${resource}:${action}`),
  ),
];

export type RoleWorld = {
  roles: Role[];
  catalog: string[];
};

export function makeRoleWorld(overrides: Partial<RoleWorld> = {}): RoleWorld {
  return {
    roles: [
      makeRole({ id: 'role-1', name: 'SINDICO', isSystem: true }),
      makeRole({
        id: 'role-2',
        name: 'PORTARIA NOTURNA',
        description: null,
        permissions: ['visitor:read'],
        isSystem: false,
      }),
    ],
    catalog: CATALOG,
    ...overrides,
  };
}

/**
 * Liga os dubles de transporte ao mundo (ADR-010).
 *
 * `GET /roles/permissions` e `GET /roles` sao servidos por handlers diferentes —
 * o primeiro por `apiGet`, o segundo por `apiGetPaginated` —, exatamente como a
 * tela os consome.
 */
export function serveRoles(world: RoleWorld): void {
  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/roles/permissions') return { permissions: world.catalog } as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    if (url !== '/roles') throw new Error(`URL nao prevista no teste: ${url}`);
    const params = (config?.params ?? {}) as Record<string, unknown>;
    return {
      data: world.roles,
      meta: makeMeta({
        total: world.roles.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiPost).mockImplementation(async (_url, body) => {
    const data = body as { name?: string; permissions?: string[] };
    return makeRole({
      id: 'role-new',
      name: (data.name ?? '').toUpperCase(),
      permissions: data.permissions ?? [],
      isSystem: false,
    }) as never;
  });

  vi.mocked(apiPatch).mockImplementation(async (_url, body) => {
    const data = (body ?? {}) as Partial<Role>;
    return { ...world.roles[0], ...data } as never;
  });

  vi.mocked(apiDelete).mockResolvedValue(undefined as never);
}

/** Os parametros da ultima listagem pedida. */
export function lastListParams(): Record<string, unknown> {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter((call) => call[0] === '/roles');
  return (calls[calls.length - 1]?.[1]?.params ?? {}) as Record<string, unknown>;
}

/** O corpo do ultimo POST. */
export function lastCreateBody(): Record<string, unknown> {
  const calls = vi.mocked(apiPost).mock.calls;
  return (calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>;
}

/** O corpo do ultimo PATCH. */
export function lastUpdateBody(): Record<string, unknown> {
  const calls = vi.mocked(apiPatch).mock.calls;
  return (calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>;
}
