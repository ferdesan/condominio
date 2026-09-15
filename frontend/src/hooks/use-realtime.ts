import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from '@/lib/api';
import { REALTIME_EVENTS, SOCKET_PATH, realtimeOrigin } from '@/lib/realtime';
import { invalidationsFor } from '@/lib/realtime-events';
import { useAuth } from './use-auth';
import { useCondominium } from './use-condominium';

/**
 * Janela de agrupamento das invalidacoes, em milissegundos.
 *
 * Uma operacao em lote no servidor — gerar as cobrancas do mes, por exemplo —
 * emite um evento por registro. Sem contencao, cada um viraria uma invalidacao
 * e a tela dispararia dezenas de requisicoes. Agrupados, viram uma.
 *
 * Curto o bastante para continuar parecendo imediato.
 */
const COALESCE_MS = 250;

/**
 * Liga o canal de tempo real enquanto houver sessao.
 *
 * **E um acelerador, e nunca um requisito.** Se o canal nao conectar — proxy sem
 * websocket, rede caindo, servidor de socket fora —, **nada muda**: as telas
 * continuam lendo por `useQuery` e se atualizando pela invalidacao das proprias
 * mutacoes, como sempre fizeram. Nenhuma tela espera por ele, nenhuma falha dele
 * vira toast, e nenhuma excecao dele sobe. E o que impede o canal de virar ponto
 * unico de falha.
 *
 * **Invalida, nao escreve.** O evento diz "este recurso mudou"; quem busca o
 * novo estado e a consulta que ja existe. Ver `lib/realtime-events.ts`.
 *
 * **O token e lido a cada tentativa de conexao**, e nao uma vez. `auth` como
 * funcao e chamada pelo socket.io em toda reconexao, entao quando o access token
 * expira e o interceptor do axios o renova, a proxima tentativa ja sai com o
 * token novo — sem precisar de um aviso que `lib/api.ts` nao emite.
 *
 * Fica no shell autenticado porque e onde existem sessao, `QueryClient` e o
 * condominio selecionado. Mesmo arranjo de `useAccountTheme`.
 */
export function useRealtime(): void {
  const { isAuthenticated } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();

  const socketRef = useRef<Socket | null>(null);
  /** Prefixos aguardando a proxima descarga. */
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Ciclo de vida da conexao
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Sem sessao nao ha o que autenticar: o handshake do servidor recusaria, e
    // tentar seria gastar reconexao para receber `UNAUTHORIZED`.
    if (!isAuthenticated) return;

    // Copiados para variaveis locais: usar `ref.current` na limpeza le o valor
    // do momento da limpeza, e nao o desta execucao do efeito — e o que a regra
    // `react-hooks/exhaustive-deps` avisa.
    const queued = pending.current;
    const scheduled = timer;

    function flush(): void {
      scheduled.current = null;
      const keys = [...queued];
      queued.clear();
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }

    function schedule(event: string): void {
      const keys = invalidationsFor(event);
      // Evento que este frontend nao conhece nao derruba nada: o servidor pode
      // ganhar um novo antes daqui.
      if (keys.length === 0) return;
      for (const key of keys) queued.add(key);
      if (scheduled.current === null) scheduled.current = setTimeout(flush, COALESCE_MS);
    }

    let socket: Socket;
    try {
      socket = io(realtimeOrigin(), {
        path: SOCKET_PATH,
        withCredentials: true,
        // Chamada a cada tentativa, inclusive nas reconexoes — e o que faz o
        // canal sobreviver a renovacao silenciosa do access token.
        auth: (cb: (data: Record<string, unknown>) => void) =>
          cb({ token: tokenStorage.accessToken ?? '' }),
      });
    } catch {
      // Construir o cliente nao deveria lancar, mas se lancar o resto da
      // aplicacao segue exatamente como antes de existir canal nenhum.
      return;
    }

    socketRef.current = socket;

    for (const event of REALTIME_EVENTS) {
      socket.on(event, () => schedule(event));
    }

    /*
      Ouvinte registrado de proposito e deliberadamente inerte.

      Falha de conexao nao e problema de quem esta usando: o socket.io ja repete
      com recuo, e as telas continuam funcionando sem o canal. Um toast culparia
      a tela por algo que nao a impede de nada, e um `console.warn` repetiria a
      cada tentativa de reconexao. O que o ouvinte faz e impedir que o erro suba
      como evento sem dono.
    */
    socket.on('connect_error', () => undefined);

    return () => {
      if (scheduled.current !== null) {
        clearTimeout(scheduled.current);
        scheduled.current = null;
      }
      queued.clear();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, queryClient]);

  // -------------------------------------------------------------------------
  // A sessao acabou de vez
  // -------------------------------------------------------------------------
  useEffect(() => {
    /**
     * `lib/api.ts` dispara este evento quando o refresh falha. O socket carrega
     * a credencial de uma sessao que deixou de existir: mante-lo aberto seria
     * manter uma conexao autenticada por algo revogado.
     */
    const onExpired = (): void => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, []);

  // -------------------------------------------------------------------------
  // O condominio selecionado no shell
  // -------------------------------------------------------------------------
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedId) return;

    /*
      O servidor ja poe o socket nas salas dos condominios do vinculo, na
      conexao. Estes dois eventos existem para o caso de quem enxerga todos do
      tenant — administrador com vinculo vazio —, que nao entra em sala nenhuma
      de condominio e so acompanha o que esta olhando agora.

      `subscribe:condominium` e conferido no servidor contra o escopo do token,
      entao pedir por um condominio sem acesso simplesmente nao surte efeito.
    */
    socket.emit('subscribe:condominium', selectedId);
    return () => {
      socket.emit('unsubscribe:condominium', selectedId);
    };
  }, [selectedId, isAuthenticated]);
}
