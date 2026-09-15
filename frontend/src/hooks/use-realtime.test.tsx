import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { io } from 'socket.io-client';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';
import { makeAuthUser, makeCondominium } from '@/test/fixtures';
import { EVENT_INVALIDATIONS, invalidationsFor } from '@/lib/realtime-events';
import { realtimeOrigin, REALTIME_EVENTS, SOCKET_PATH } from '@/lib/realtime';
import { useRealtime } from './use-realtime';

/**
 * O duble fica na fronteira do transporte, como o `@/lib/api` no ADR-010: o que
 * se afirma e o ciclo de vida e o mapeamento, e nao o comportamento da
 * biblioteca de socket. Abrir uma conexao de verdade tornaria o caso dependente
 * de rede para provar uma decisao que e toda nossa.
 */
vi.mock('socket.io-client', () => ({ io: vi.fn() }));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

const mockIo = vi.mocked(io);

/** Socket de mentira que guarda os ouvintes para o teste disparar. */
type FakeSocket = {
  handlers: Map<string, (payload?: unknown) => void>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (payload?: unknown) => void) => FakeSocket;
  /** Dispara um evento como se tivesse vindo do servidor. */
  fire: (event: string, payload?: unknown) => void;
};

function makeSocket(): FakeSocket {
  const handlers = new Map<string, (payload?: unknown) => void>();
  const socket: FakeSocket = {
    handlers,
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    on(event, handler) {
      handlers.set(event, handler);
      return socket;
    },
    fire(event, payload) {
      handlers.get(event)?.(payload);
    },
  };
  return socket;
}

/**
 * O espiao, com o tipo inferido da propria chamada.
 *
 * `ReturnType<typeof vi.spyOn>` sozinho resolve para a assinatura generica do
 * utilitario, que nao aceita a de `invalidateQueries`. Envolver a chamada faz o
 * TypeScript inferir a assinatura certa sem escrever o generico a mao.
 */
function spyOnInvalidate(client: QueryClient) {
  return vi.spyOn(client, 'invalidateQueries');
}

let socket: FakeSocket;
let queryClient: QueryClient;
let invalidate: ReturnType<typeof spyOnInvalidate>;

const CONDOMINIUM = makeCondominium({ id: 'cond-1' });

function Probe() {
  useRealtime();
  return null;
}

/**
 * Monta o hook com sessao e condominio controlados.
 *
 * Os contextos entram a mao, e nao pelo harness compartilhado: o que se
 * exercita aqui e a reacao a `isAuthenticated` e a `selectedId`, entao os dois
 * precisam ser ajustaveis por caso.
 */
function mount(options: { authenticated?: boolean; condominiumId?: string | null } = {}) {
  const { authenticated = true, condominiumId = CONDOMINIUM.id } = options;

  const auth: AuthContextValue = {
    user: authenticated ? makeAuthUser() : null,
    initializing: false,
    isAuthenticated: authenticated,
    login: async () => undefined,
    logout: async () => undefined,
    updateUser: () => undefined,
    can: () => true,
  };

  const selected = condominiumId ? makeCondominium({ id: condominiumId }) : null;
  const condominium: CondominiumContextValue = {
    condominiums: selected ? [selected] : [],
    selected,
    selectedId: condominiumId,
    select: () => undefined,
    isLoading: false,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <CondominiumContext.Provider value={condominium}>
          <Probe />
        </CondominiumContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  socket = makeSocket();
  mockIo.mockReturnValue(socket as never);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = spyOnInvalidate(queryClient);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Avanca o relogio alem da janela de agrupamento e deixa os efeitos rodarem. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(400);
}

describe('Ciclo de vida da conexao', () => {
  it('sem sessao, nenhuma conexao e tentada', () => {
    mount({ authenticated: false });

    // O handshake do servidor recusaria: tentar seria gastar reconexao para
    // receber `UNAUTHORIZED`.
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('com sessao, conecta no caminho que o servidor monta', () => {
    mount();

    expect(mockIo).toHaveBeenCalledTimes(1);
    const [, options] = mockIo.mock.calls[0] ?? [];
    expect((options as { path?: string })?.path).toBe(SOCKET_PATH);
  });

  it('o token e lido a cada tentativa, e nao fixado na montagem', () => {
    localStorage.setItem('condominio.accessToken', 'token-inicial');
    mount();

    const [, options] = mockIo.mock.calls[0] ?? [];
    const auth = (options as { auth?: (cb: (data: Record<string, unknown>) => void) => void })
      ?.auth;
    expect(typeof auth).toBe('function');

    // Chamada de novo depois de o interceptor renovar o token: e assim que a
    // reconexao sobrevive a expiracao do access token.
    localStorage.setItem('condominio.accessToken', 'token-renovado');
    let sent: Record<string, unknown> = {};
    auth?.((data) => {
      sent = data;
    });
    expect(sent.token).toBe('token-renovado');
  });

  it('desmontar desconecta e remove os ouvintes', () => {
    const view = mount();
    view.unmount();

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.removeAllListeners).toHaveBeenCalled();
  });

  it('sessao expirada de vez desconecta o socket', () => {
    mount();

    // `lib/api.ts` dispara isto quando o refresh falha: manter a conexao seria
    // mante-la autenticada por uma credencial revogada.
    window.dispatchEvent(new CustomEvent('auth:session-expired'));

    expect(socket.disconnect).toHaveBeenCalled();
  });
});

describe('Assinatura do condominio', () => {
  it('assina o condominio selecionado', () => {
    mount();

    expect(socket.emit).toHaveBeenCalledWith('subscribe:condominium', 'cond-1');
  });

  it('trocar de condominio cancela o anterior e assina o novo', () => {
    const view = mount({ condominiumId: 'cond-1' });
    socket.emit.mockClear();

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: makeAuthUser(),
            initializing: false,
            isAuthenticated: true,
            login: async () => undefined,
            logout: async () => undefined,
            updateUser: () => undefined,
            can: () => true,
          }}
        >
          <CondominiumContext.Provider
            value={{
              condominiums: [makeCondominium({ id: 'cond-2' })],
              selected: makeCondominium({ id: 'cond-2' }),
              selectedId: 'cond-2',
              select: () => undefined,
              isLoading: false,
            }}
          >
            <Probe />
          </CondominiumContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(socket.emit).toHaveBeenCalledWith('unsubscribe:condominium', 'cond-1');
    expect(socket.emit).toHaveBeenCalledWith('subscribe:condominium', 'cond-2');
  });

  it('sem condominio selecionado, nao assina nada', () => {
    mount({ condominiumId: null });

    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('Mapeamento de evento para invalidacao', () => {
  it.each(Object.entries(EVENT_INVALIDATIONS))(
    '%s invalida exatamente as chaves declaradas',
    async (event, expected) => {
      mount();
      invalidate.mockClear();

      socket.fire(event);
      await settle();

      const invalidated = invalidate.mock.calls
        .map(([options]) => (options as { queryKey: string[] }).queryKey[0])
        .sort();
      expect(invalidated).toEqual([...expected].sort());
    },
  );

  it('dashboard:refresh nao invalida nada, porque nenhum servico o emite', async () => {
    mount();
    invalidate.mockClear();

    socket.fire('dashboard:refresh');
    await settle();

    // Esta declarado no union do servidor e `grep` nao acha nenhum emissor.
    expect(invalidationsFor('dashboard:refresh')).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('evento desconhecido nao derruba o canal', async () => {
    mount();
    invalidate.mockClear();

    // O servidor pode ganhar um evento antes deste frontend.
    expect(() => socket.fire('coisa:nova')).not.toThrow();
    await settle();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('todos os nove eventos do servidor tem ouvinte', () => {
    mount();

    for (const event of REALTIME_EVENTS) {
      expect(socket.handlers.has(event), event).toBe(true);
    }
  });
});

describe('Contencao', () => {
  it('uma rajada do mesmo recurso produz uma invalidacao so', async () => {
    mount();
    invalidate.mockClear();

    // Gerar as cobrancas do mes emite um evento por registro; sem contencao
    // seriam dezenas de requisicoes.
    for (let index = 0; index < 20; index += 1) socket.fire('charge:updated');
    await settle();

    const chargeCalls = invalidate.mock.calls.filter(
      ([options]) => (options as { queryKey: string[] }).queryKey[0] === 'financial/charges',
    );
    expect(chargeCalls).toHaveLength(1);
  });

  it('eventos de recursos diferentes invalidam cada um o seu', async () => {
    mount();
    invalidate.mockClear();

    socket.fire('notification:new');
    socket.fire('announcement:published');
    await settle();

    const keys = invalidate.mock.calls
      .map(([options]) => (options as { queryKey: string[] }).queryKey[0])
      .sort();
    expect(keys).toEqual(['announcements', 'notifications']);
  });

  it('desmontar antes da descarga nao invalida nada', async () => {
    const view = mount();
    invalidate.mockClear();

    socket.fire('charge:updated');
    view.unmount();
    await settle();

    // O temporizador e cancelado na limpeza: uma invalidacao depois da
    // desmontagem tocaria um cache que a tela ja nao observa.
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('Degradacao silenciosa', () => {
  it('falha de conexao nao vira toast nem lanca', async () => {
    const { toast } = await import('sonner');
    mount();

    expect(() => socket.fire('connect_error', new Error('websocket indisponivel'))).not.toThrow();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('o cliente que lanca na construcao nao derruba a tela', () => {
    mockIo.mockImplementation(() => {
      throw new Error('falha ao construir o cliente');
    });

    // O resto da aplicacao segue exatamente como antes de existir canal nenhum.
    expect(() => mount()).not.toThrow();
  });
});

describe('Origem do canal', () => {
  it('de uma URL absoluta, usa a origem e descarta o caminho da API', () => {
    // O socket nao vive sob `/api/v1`: `initSocketServer` monta na raiz.
    expect(realtimeOrigin('http://localhost:3333/api/v1')).toBe('http://localhost:3333');
  });

  it('de uma URL relativa, deixa o cliente usar a origem da pagina', () => {
    expect(realtimeOrigin('/api/v1')).toBeUndefined();
  });
});
