import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '@/lib/api';
import { makePollResults } from './test-utils';
import {
  POLLS_KEY,
  useCastProxyVote,
  useCastVote,
  useMyVote,
  useVoteStatus,
} from './assembly-hooks';

// A camada de transporte e o unico duble (ADR-010); `ApiError` continua real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  };
});

const mockGet = vi.mocked(apiGet);
const mockPost = vi.mocked(apiPost);

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMyVote', () => {
  it('UT-141: busca my-vote sob a chave polls e fica desligada sem id', async () => {
    const { queryClient, wrapper } = makeHarness();
    mockGet.mockResolvedValue({ voted: false });

    const idle = renderHook(() => useMyVote(''), { wrapper });
    expect(mockGet).not.toHaveBeenCalled();
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => useMyVote('poll-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/polls/poll-1/my-vote');
    expect(
      queryClient.getQueryCache().find({ queryKey: ['polls', 'my-vote', 'poll-1'] }),
    ).toBeDefined();
    expect(POLLS_KEY).toBe('polls');
  });
});

describe('useCastVote', () => {
  it('UT-142: envia optionId para /vote e invalida a chave polls', async () => {
    const { invalidate, wrapper } = makeHarness();
    const results = makePollResults();
    mockPost.mockResolvedValue(results);

    const { result } = renderHook(() => useCastVote('poll-1'), { wrapper });
    const resolved = await result.current.mutateAsync({ optionId: 'option-1' });

    expect(resolved).toEqual(results);
    expect(mockPost).toHaveBeenCalledWith('/polls/poll-1/vote', { optionId: 'option-1' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['polls'] });
  });
});

describe('useVoteStatus', () => {
  it('UT-143: busca vote-status sob a chave polls', async () => {
    const { queryClient, wrapper } = makeHarness();
    const status = [
      { unitId: 'unit-9', unitNumber: '101', status: 'PENDING' as const },
      { unitId: 'unit-10', unitNumber: '102', status: 'VOTED' as const },
    ];
    mockGet.mockResolvedValue(status);

    const { result } = renderHook(() => useVoteStatus('poll-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/polls/poll-1/vote-status');
    expect(result.current.data).toEqual(status);
    expect(
      queryClient.getQueryCache().find({ queryKey: ['polls', 'vote-status', 'poll-1'] }),
    ).toBeDefined();
  });
});

describe('useCastProxyVote', () => {
  it('UT-144: envia unitId e optionId para /votes e invalida a chave polls', async () => {
    const { invalidate, wrapper } = makeHarness();
    const results = makePollResults();
    mockPost.mockResolvedValue(results);

    const { result } = renderHook(() => useCastProxyVote('poll-1'), { wrapper });
    const resolved = await result.current.mutateAsync({
      unitId: 'unit-9',
      optionId: 'option-1',
    });

    expect(resolved).toEqual(results);
    expect(mockPost).toHaveBeenCalledWith('/polls/poll-1/votes', {
      unitId: 'unit-9',
      optionId: 'option-1',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['polls'] });
  });
});
