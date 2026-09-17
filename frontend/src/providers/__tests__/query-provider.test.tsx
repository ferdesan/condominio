/**
 * UT-030 — politica de erro do `QueryProvider`.
 *
 * O provider configura o client compartilhado:
 *  - 401 e silencioso e nao reexecuta: o interceptor do transporte ja dispara o
 *    logout, e um toast culparia a acao por algo que nao foi ela.
 *  - 4xx nao melhora com repeticao: `retry: false`.
 *  - erro de servidor (5xx) entra na politica de retry padrao.
 *  - erro de mutacao mostra toast (salvo 401).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { QueryProvider } from '../query-provider';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

const toastError = vi.mocked(toast.error);

/**
 * Chave estavel por montagem: um incremento dentro do `render` criaria uma
 * query nova a cada re-render — e o que se observa no caso erra na mao.
 */
function QueryProbe({ index, fn }: { index: number; fn: () => Promise<unknown> }) {
  const { status, failureCount } = useQuery({ queryKey: ['probe', index], queryFn: fn });
  return (
    <p data-testid="query">
      {status}:{failureCount}
    </p>
  );
}

function MutationProbe({ fn }: { fn: () => Promise<unknown> }) {
  const mutation = useMutation({ mutationFn: fn });
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!fired) {
      setFired(true);
      mutation.mutate();
    }
  }, [fired, mutation]);
  return <p data-testid="mutation">{mutation.status}</p>;
}

describe('QueryProvider (UT-030)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UT-030: 401 em consulta e ignorado — sem toast e sem retry', async () => {
    const fn = vi.fn(async () => {
      throw new ApiError('Sessao expirada.', 401, 'UNAUTHORIZED');
    });

    render(
      <QueryProvider>
        <QueryProbe index={1} fn={fn} />
      </QueryProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('query')).toHaveTextContent('error'));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('UT-030.E1: erro de mutacao mostra o toast com a mensagem', async () => {
    const fn = vi.fn(async () => {
      throw new ApiError('Falha no pagamento.', 400, 'VALIDATION_ERROR');
    });

    render(
      <QueryProvider>
        <MutationProbe fn={fn} />
      </QueryProvider>,
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Falha no pagamento.'));
  });

  it('UT-030.E2: erro de servidor entra na politica de retry', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async () => {
        throw new ApiError('Erro no servidor.', 500, 'SERVER_ERROR');
      });

      render(
        <QueryProvider>
          <QueryProbe index={2} fn={fn} />
        </QueryProvider>,
      );

      // Primeira falha; 5xx nao desiste: agenda a repeticao.
      await act(async () => {});
      expect(fn).toHaveBeenCalledTimes(1);

      // Avanca o tempo alem do backoff: a consulta e repetida — e para de
      // repetir sozinha (a contagem apos a pausa longa e estavel).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      const afterRetries = fn.mock.calls.length;
      expect(afterRetries).toBeGreaterThanOrEqual(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fn).toHaveBeenCalledTimes(afterRetries);

      // Continua em erro — ha falha acumulada, nao um estado pendente.
      expect(screen.getByTestId('query')).toHaveTextContent(/^error:/);
    } finally {
      vi.useRealTimers();
    }
  });
});