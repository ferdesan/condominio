import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  type Paginated,
} from '@/lib/api';
import type { Unit } from '@/types/api';
import { makePage, makeUnit } from '@/test/fixtures';
import { createResourceHooks } from './resource-hooks';

// A camada de transporte e o unico duble (ADR-010); `ApiError` continua real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiGetPaginated: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const mockGet = vi.mocked(apiGet);
const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);

type CreateUnit = { number: string };
type UpdateUnit = Partial<CreateUnit>;

function makeHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, invalidate, wrapper };
}

const unitHooks = createResourceHooks<Unit, CreateUnit, UpdateUnit>('units');
const reservationHooks = createResourceHooks<Unit, CreateUnit, UpdateUnit>('reservations');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useList', () => {
  const params = { page: 2, perPage: 20, filters: { status: 'VACANT' } };

  it('UT-029: monta a query key do recurso e chama o transporte uma única vez', async () => {
    const { queryClient, wrapper } = makeHarness();
    mockGetPaginated.mockResolvedValue(makePage([makeUnit()]));

    const { result } = renderHook(() => unitHooks.useList(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryCache().find({ queryKey: ['units', 'list', params] })).toBeDefined();
    expect(mockGetPaginated).toHaveBeenCalledTimes(1);
    expect(mockGetPaginated).toHaveBeenCalledWith('/units', {
      params: { page: 2, perPage: 20, status: 'VACANT' },
    });
  });

  it('UT-030: devolve data e meta exatamente como vieram do transporte', async () => {
    const { wrapper } = makeHarness();
    const page: Paginated<Unit> = makePage([makeUnit(), makeUnit({ id: 'unit-2' })], {
      page: 2,
      perPage: 20,
      total: 42,
    });
    mockGetPaginated.mockResolvedValue(page);

    const { result } = renderHook(() => unitHooks.useList(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(page);
    expect(result.current.data?.meta.total).toBe(42);
  });

  it('UT-031: com enabled false não dispara requisição', () => {
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => unitHooks.useList(params, { enabled: false }), { wrapper });

    expect(mockGetPaginated).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('UT-037: propaga o ApiError sem alterar status nem code', async () => {
    const { wrapper } = makeHarness();
    mockGetPaginated.mockRejectedValue(new ApiError('Sem permissao.', 403, 'FORBIDDEN'));

    const { result } = renderHook(() => unitHooks.useList(params), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(403);
    expect(result.current.error?.code).toBe('FORBIDDEN');
    expect(result.current.error?.message).toBe('Sem permissao.');
  });
});

describe('useOne', () => {
  it('UT-032: monta a key de detalhe e não busca quando o id e nulo', async () => {
    const { queryClient, wrapper } = makeHarness();
    mockGet.mockResolvedValue(makeUnit());

    const idle = renderHook(() => reservationHooks.useOne(null), { wrapper });
    expect(mockGet).not.toHaveBeenCalled();
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => reservationHooks.useOne('reservation-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/reservations/reservation-1');
    expect(
      queryClient.getQueryCache().find({ queryKey: ['reservations', 'detail', 'reservation-1'] }),
    ).toBeDefined();
  });
});

describe('mutacoes', () => {
  it('UT-033: create inválida a chave do recurso exatamente uma vez', async () => {
    const { invalidate, wrapper } = makeHarness();
    mockPost.mockResolvedValue(makeUnit());

    const { result } = renderHook(() => reservationHooks.useCreate(), { wrapper });
    await result.current.mutateAsync({ number: '101' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reservations'] });
  });

  it('UT-034: update interpola o id na URL em vez de envia-lo como parametro', async () => {
    const { wrapper } = makeHarness();
    mockPatch.mockResolvedValue(makeUnit());

    const { result } = renderHook(() => unitHooks.useUpdate(), { wrapper });
    await result.current.mutateAsync({ id: 'unit-9', data: { number: '202' } });

    expect(mockPatch).toHaveBeenCalledWith('/units/unit-9', { number: '202' });
    expect(mockPatch.mock.calls[0]).toHaveLength(2);
  });

  it('UT-035: remove chama apiDelete e resolve para undefined', async () => {
    const { wrapper } = makeHarness();
    mockDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => unitHooks.useRemove(), { wrapper });
    const resolved = await result.current.mutateAsync('unit-9');

    expect(mockDelete).toHaveBeenCalledWith('/units/unit-9');
    expect(resolved).toBeUndefined();
  });

  it('UT-036: extraInvalidate acrescenta a chave do seletor do shell', async () => {
    const { invalidate, wrapper } = makeHarness();
    const condominiumHooks = createResourceHooks<Unit, CreateUnit, UpdateUnit>('condominiums', {
      extraInvalidate: [['condominiums', 'options']],
    });
    mockPost.mockResolvedValue(makeUnit());

    const { result } = renderHook(() => condominiumHooks.useCreate(), { wrapper });
    await result.current.mutateAsync({ number: '101' });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['condominiums'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['condominiums', 'options'] });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('UT-040: restore recusado com 409 não inválida nem mexe no cache', async () => {
    const { queryClient, invalidate, wrapper } = makeHarness();
    const cached = makePage([makeUnit()]);
    queryClient.setQueryData(['units', 'list', { page: 1, perPage: 20 }], cached);
    mockPost.mockRejectedValue(new ApiError('Já existe um registro ativo.', 409, 'CONFLICT'));

    const { result } = renderHook(() => unitHooks.useRestore(), { wrapper });
    await expect(result.current.mutateAsync('unit-9')).rejects.toBeInstanceOf(ApiError);

    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['units', 'list', { page: 1, perPage: 20 }])).toBe(cached);
  });
});

describe('useCount', () => {
  it('UT-038: pede uma pagina de um registro com os filtros e devolve meta.total', async () => {
    const { wrapper } = makeHarness();
    mockGetPaginated.mockResolvedValue(makePage([makeUnit()], { perPage: 1, total: 17 }));

    const { result } = renderHook(() => unitHooks.useCount({ status: 'VACANT' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetPaginated).toHaveBeenCalledWith('/units', {
      params: { page: 1, perPage: 1, status: 'VACANT' },
    });
    expect(result.current.data).toBe(17);
  });

  it('UT-039: total zero devolve 0, distinguível do undefined de carregamento', async () => {
    const { wrapper } = makeHarness();
    mockGetPaginated.mockResolvedValue(makePage([], { perPage: 1, total: 0 }));

    const { result } = renderHook(() => unitHooks.useCount({ status: 'BLOCKED' }), { wrapper });
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
    expect(result.current.data).not.toBeUndefined();
  });
});
