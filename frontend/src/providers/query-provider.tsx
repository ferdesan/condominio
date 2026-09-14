import { useState, type ReactNode } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

/**
 * Um QueryClient por montagem da app (e nao um singleton de modulo) para que os
 * testes nao compartilhem cache entre casos.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // 401 e tratado pelo interceptor do axios, que dispara o logout.
        if (error instanceof ApiError && error.status === 401) return;
        toast.error(error instanceof ApiError ? error.message : 'Falha ao carregar os dados.');
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Erro do cliente (400-499) nao melhora com repeticao.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        onError: (error) => {
          // Mesmo motivo das consultas: 401 nao e falha da acao, e sim a sessao
          // que acabou. O interceptor ja dispara o logout e a rota leva ao login;
          // um toast aqui culparia a acao por algo que nao foi ela (US-026.EC-2).
          if (error instanceof ApiError && error.status === 401) return;
          toast.error(
            error instanceof ApiError ? error.message : 'Nao foi possivel concluir a operacao.',
          );
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
