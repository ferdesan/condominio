/**
 * Camada de dados do perfil.
 *
 * **Nao usa a fabrica do ADR-008.** Ela monta as seis operacoes do roteador CRUD
 * sobre um recurso; aqui nao ha recurso nenhum — sao quatro rotas avulsas de
 * `/auth` que agem sempre sobre o portador do token. Nao existe listar, criar
 * nem excluir, e o `:id` nao entra em lugar nenhum.
 *
 * **Nenhuma permissao e conferida.** `auth.routes.ts` protege as quatro apenas
 * com `authenticate`, sem `authorize`: quem tem sessao pode editar a propria
 * conta. Exigir uma permissao no cliente esconderia a tela de quem o servidor
 * atenderia — o mesmo raciocinio de `/notificacoes`.
 *
 * **Duas destas quatro encerram a sessao.** `changePassword` e `logoutAll`
 * chamam `revokeAllForUser` no servidor, que revoga *todos* os refresh tokens,
 * inclusive o deste navegador. Nao ha "manter esta sessao": quem chama precisa
 * deslogar em seguida, e e por isso que os dois hooks abaixo nao invalidam cache
 * nenhum — nao ha para quem devolver os dados.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/api';
import type { AuthUser } from '@/types/api';
import type { UserSession } from '@/types/profile';
import type { ProfilePayload } from './profile-schema';

export const PROFILE_KEY = 'profile';

type Callbacks<TData, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: ApiError, variables: TVariables) => void;
};

/**
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
function optionalOnError<TData, TVariables>(
  callbacks: Callbacks<TData, TVariables>,
): { onError?: (error: ApiError, variables: TVariables) => void } {
  return callbacks.onError ? { onError: callbacks.onError } : {};
}

/**
 * Salva nome, telefone e preferencias.
 *
 * A resposta e o `AuthUser` inteiro, ja remontado pelo servidor — por isso a
 * tela a entrega ao contexto de autenticacao em vez de refazer `/auth/me`.
 *
 * `preferences` e **mesclado** no servidor (`{ ...user.preferences, ...dto }`),
 * entao mandar apenas o tema nao apaga `locale` nem as flags de notificacao que
 * a semente gravou e esta tela nao oferece.
 */
export function useUpdateProfile(
  callbacks: Callbacks<AuthUser, ProfilePayload> = {},
): UseMutationResult<AuthUser, ApiError, ProfilePayload> {
  return useMutation<AuthUser, ApiError, ProfilePayload>({
    mutationFn: (data) => apiPatch<AuthUser>('/auth/me', data),
    onSuccess: (data, variables) => callbacks.onSuccess?.(data, variables),
    ...optionalOnError(callbacks),
  });
}

export type ChangePasswordVariables = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Troca a senha. Responde 204 — nao ha corpo.
 *
 * Recusa 401 com "Senha atual incorreta." quando a conferencia falha; e a unica
 * rota autenticada do sistema onde 401 significa "este campo esta errado" e nao
 * "sua sessao acabou", entao a tela precisa trata-la como erro de campo.
 */
export function useChangePassword(
  callbacks: Callbacks<void, ChangePasswordVariables> = {},
): UseMutationResult<void, ApiError, ChangePasswordVariables> {
  return useMutation<void, ApiError, ChangePasswordVariables>({
    mutationFn: async (data) => {
      await apiPost<void>('/auth/change-password', data);
    },
    onSuccess: (data, variables) => callbacks.onSuccess?.(data, variables),
    ...optionalOnError(callbacks),
  });
}

/**
 * As sessoes ativas.
 *
 * `staleTime: 0` de proposito: a lista muda por fora — outro login, outro
 * logout —, e uma resposta guardada daria a impressao de um inventario que nao
 * corresponde mais a nada.
 */
export function useSessions(): UseQueryResult<UserSession[], ApiError> {
  return useQuery<UserSession[], ApiError>({
    queryKey: [PROFILE_KEY, 'sessions'],
    queryFn: () => apiGet<UserSession[]>('/auth/sessions'),
    staleTime: 0,
  });
}

/**
 * Encerra as sessoes. **Todas**, inclusive a deste navegador.
 *
 * O servidor nao oferece revogar uma sessao especifica — `revokeAllForUser`
 * varre o usuario inteiro —, e por isso nao ha botao por linha na tabela.
 *
 * Limpa o cache inteiro no sucesso porque o que ele guarda pertence a uma sessao
 * que deixou de existir; a tela desloga logo em seguida.
 */
export function useLogoutAll(
  callbacks: Callbacks<void, void> = {},
): UseMutationResult<void, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      await apiPost<void>('/auth/logout-all', {});
    },
    onSuccess: (data, variables) => {
      queryClient.clear();
      callbacks.onSuccess?.(data, variables);
    },
    ...optionalOnError(callbacks),
  });
}
