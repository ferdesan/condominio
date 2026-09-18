/**
 * Fixtures e duble de transporte dos testes de assembleias (ADR-010).
 *
 * Ficam ao lado da feature, e nao em `src/test/fixtures.ts`, pela mesma razao
 * que os tipos ficam em `types/assembly.ts`: aquele arquivo e compartilhado
 * entre tasks. Como a fixture e tipada contra o contrato, uma divergencia
 * quebra no type check e nao em runtime.
 *
 * Nao e um arquivo de teste: o vitest so coleta `*.test.*`.
 */

import { vi } from 'vitest';
import { apiGet, apiGetPaginated } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import type { Assembly, Poll, PollOption, PollResults } from '@/types/assembly';

const TIMESTAMPS = {
  createdAt: '2026-03-10T12:00:00.000Z',
  updatedAt: '2026-03-10T12:00:00.000Z',
  deletedAt: null,
} as const;

export function makeAssembly(overrides: Partial<Assembly> = {}): Assembly {
  return {
    id: 'assembly-1',
    condominiumId: 'cond-1',
    title: 'AGO 2026',
    description: 'Prestação de contas e eleição do síndico.',
    type: 'ORDINARY',
    status: 'SCHEDULED',
    mode: 'HYBRID',
    scheduledAt: '2026-04-10T23:00:00.000Z',
    secondCallAt: '2026-04-10T23:30:00.000Z',
    location: 'Salao de Festas',
    onlineUrl: null,
    quorumPercent: 50,
    agendaUrl: null,
    minutesUrl: null,
    startedAt: null,
    finishedAt: null,
    attendeesCount: 0,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makePollOption(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: 'option-1',
    pollId: 'poll-1',
    label: 'Aprovo',
    description: null,
    sortOrder: 0,
    votesCount: 0,
    votesWeight: 0,
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makePoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'poll-1',
    condominiumId: 'cond-1',
    assemblyId: 'assembly-1',
    title: 'Aprovação das contas de 2025',
    description: null,
    status: 'DRAFT',
    voterType: 'OWNERS',
    weightedByFraction: false,
    isSecret: false,
    allowMultiple: false,
    startsAt: '2026-04-10T23:00:00.000Z',
    endsAt: '2026-04-11T23:00:00.000Z',
    quorumPercent: 0,
    totalVotes: 0,
    eligibleUnits: 48,
    resultsPublishedAt: null,
    options: [makePollOption(), makePollOption({ id: 'option-2', label: 'Rejeito', sortOrder: 1 })],
    ...TIMESTAMPS,
    ...overrides,
  };
}

export function makePollResults(overrides: Partial<PollResults> = {}): PollResults {
  return {
    pollId: 'poll-1',
    title: 'Aprovação das contas de 2025',
    status: 'CLOSED',
    totalVotes: 30,
    eligibleUnits: 48,
    participationPercent: 62.5,
    quorumPercent: 50,
    quorumReached: true,
    weighted: false,
    options: [
      { id: 'option-1', label: 'Aprovo', votesCount: 22, votesWeight: 0, percent: 73.33 },
      { id: 'option-2', label: 'Rejeito', votesCount: 8, votesWeight: 0, percent: 26.67 },
    ],
    ...overrides,
  };
}

export type RequestParams = Record<string, unknown>;

/** Estado do servidor durante um caso, mutavel para que o refetch mostre o efeito. */
export type AssemblyWorld = {
  assemblies: Assembly[];
  /** Resposta de `/assemblies/upcoming` — array cru, sem `meta`. */
  upcoming: Assembly[];
  polls: Poll[];
  results: PollResults;
  /** `meta.total` da listagem, para exercitar a paginacao sem servir 300 linhas. */
  total?: number;
};

/**
 * Responde as quatro rotas de leitura que a tela alcanca a partir de uma unica
 * descricao do mundo. O objeto devolvido e o mesmo que os mocks leem, entao
 * mutar um campo dele muda o que a proxima requisicao ve.
 */
export function serveAssemblies(initial: Partial<AssemblyWorld> = {}): AssemblyWorld {
  const world: AssemblyWorld = {
    assemblies: [],
    upcoming: [],
    polls: [],
    results: makePollResults(),
    ...initial,
  };

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as RequestParams;

    if (url === '/polls') {
      return {
        data: world.polls,
        meta: makeMeta({ total: world.polls.length, perPage: 20 }),
      } as never;
    }
    if (url !== '/assemblies') {
      throw new Error(`URL de listagem nao prevista no teste: ${url}`);
    }

    return {
      data: world.assemblies,
      meta: makeMeta({
        total: world.total ?? world.assemblies.length,
        page: Number(params.page ?? 1),
        perPage: Number(params.perPage ?? 20),
      }),
    } as never;
  });

  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/assemblies/upcoming') return world.upcoming as never;
    if (/^\/polls\/[^/]+\/results$/.test(url)) return world.results as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  return world;
}

/** Os parametros da ultima listagem de assembleias pedida pela tela. */
export function lastListParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/assemblies');
  return (calls.at(-1)?.[1]?.params ?? {}) as RequestParams;
}

/** Os parametros da ultima listagem de deliberacoes pedida pelo painel. */
export function lastPollParams(): RequestParams {
  const calls = vi.mocked(apiGetPaginated).mock.calls.filter(([url]) => url === '/polls');
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
