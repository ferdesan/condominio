/**
 * Fixtures e duble de transporte dos testes de usuarios (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/user.ts`: aquele arquivo e compartilhado entre as
 * tasks deste tier e ja foi ponto de quebra. Como a fixture e tipada contra o
 * contrato, uma divergencia quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta, makeUnit } from '@/test/fixtures';
import type { Unit } from '@/types/api';
import type { Role } from '@/types/role';
import type { User } from '@/types/user';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'SINDICO',
    description: 'Administra o condominio no dia a dia.',
    permissions: ['condominium:manage'],
    isSystem: true,
    ...TIMESTAMPS,
    ...overrides,
  };
}

/**
 * Usuario do tenant.
 *
 * `role` e `condominiums` vem aninhados na resposta de `/users`
 * (`UserRepository.relations`), e nao por consulta separada — e a listagem
 * precisa exibir os dois.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Marina Alves',
    email: 'marina@exemplo.com',
    phone: '11988887777',
    document: '12345678909',
    avatarUrl: null,
    status: 'ACTIVE',
    roleId: 'role-1',
    role: makeRole(),
    condominiums: [{ id: 'cond-1', name: 'Residencial Aurora' }],
    unitId: null,
    lastLoginAt: '2026-03-09T18:20:00.000Z',
    mustChangePassword: false,
    emailVerifiedAt: '2026-01-11T10:00:00.000Z',
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type UserWorld = {
  users: User[];
  roles: Role[];
  units: Unit[];
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as tres rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 *
 * `apiGet` tambem e coberto, e sempre falha: esta tela nao tem endpoint auxiliar
 * de leitura simples, e uma chamada inesperada precisa aparecer como erro em vez
 * de resolver para `undefined`.
 */
export function serveUsers(initial: Partial<UserWorld> = {}): UserWorld {
  const world: UserWorld = {
    users: [],
    roles: [makeRole(), makeRole({ id: 'role-2', name: 'STAFF', isSystem: true })],
    units: [makeUnit()],
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/roles') {
      return { data: world.roles, meta: makeMeta({ total: world.roles.length, perPage: 200 }) };
    }
    if (url === '/units') {
      return { data: world.units, meta: makeMeta({ total: world.units.length, perPage: 200 }) };
    }
    if (url !== '/users') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.users,
      meta: makeMeta({
        total: world.total ?? world.users.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de usuarios pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/users');
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
