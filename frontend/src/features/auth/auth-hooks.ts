/**
 * Camada de dados da recuperacao de senha.
 *
 * As duas rotas sao **publicas** e passam pelo `authRateLimiter` do servidor.
 * Nao ha consulta aqui, so as duas escritas — e, como em `features/profile/`, a
 * fabrica do ADR-008 nao se aplica: nao ha recurso nem `:id`.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { apiPost, type ApiError } from '@/lib/api';

type Callbacks<TVariables> = {
  onSuccess?: (variables: TVariables) => void;
  /**
   * So entra no objeto quando quem chamou informou um: escrever
   * `onError: undefined` tambem substituiria o handler global do React Query v5,
   * e o toast sumiria sem nada no lugar.
   */
  onError?: (error: ApiError, variables: TVariables) => void;
};

function optionalOnError<TVariables>(
  callbacks: Callbacks<TVariables>,
): { onError?: (error: ApiError, variables: TVariables) => void } {
  return callbacks.onError ? { onError: callbacks.onError } : {};
}

/**
 * Resposta de `POST /auth/forgot-password`.
 *
 * **`token` so vem fora de producao.** `authService.forgotPassword` o devolve
 * para facilitar a integracao local, e o omite no deploy. Esta declarado aqui
 * para que o tipo corresponda ao que chega — e **nenhuma tela o le**. Uma
 * interface que o consumisse funcionaria em desenvolvimento e falharia em
 * producao, que e a pior forma de um defeito existir.
 */
export type ForgotPasswordResult = {
  message: string;
  token?: string;
};

export type ForgotPasswordVariables = { email: string };

/**
 * Pede o link de recuperacao.
 *
 * **Responde 202 mesmo quando a conta nao existe**, de proposito: e a protecao
 * contra enumeracao de contas. `authService.forgotPassword` procura o usuario e
 * simplesmente retorna quando nao encontra, sem sinalizar nada.
 *
 * A consequencia para a tela e direta: **nao ha caso de erro a distinguir**. Um
 * `onError` aqui so trataria falha de rede ou o limite de tentativas do
 * `authRateLimiter` — nunca "este e-mail nao existe", que o servidor nao conta.
 */
export function useForgotPassword(
  callbacks: Callbacks<ForgotPasswordVariables> = {},
): UseMutationResult<ForgotPasswordResult, ApiError, ForgotPasswordVariables> {
  return useMutation<ForgotPasswordResult, ApiError, ForgotPasswordVariables>({
    mutationFn: (data) => apiPost<ForgotPasswordResult>('/auth/forgot-password', data),
    onSuccess: (_data, variables) => callbacks.onSuccess?.(variables),
    ...optionalOnError(callbacks),
  });
}

export type ResetPasswordVariables = {
  token: string;
  password: string;
};

/**
 * Redefine a senha com o token do e-mail. Responde 204 — nao ha corpo.
 *
 * **Derruba todas as sessoes.** `authService.resetPassword` chama
 * `revokeAllForUser` antes de responder, como a troca de senha no perfil: todo
 * refresh token do usuario e revogado. Quem estava logado noutro dispositivo
 * precisa entrar de novo, e a tela precisa dizer isso antes do envio.
 *
 * **Uma unica mensagem para tres recusas.** Token desconhecido, ja usado e
 * expirado produzem o mesmo `BadRequestError` (400) com o mesmo texto. Tambem e
 * deliberado: distingui-los diria a quem tem um token invalido se ele um dia
 * foi valido.
 */
export function useResetPassword(
  callbacks: Callbacks<ResetPasswordVariables> = {},
): UseMutationResult<void, ApiError, ResetPasswordVariables> {
  return useMutation<void, ApiError, ResetPasswordVariables>({
    mutationFn: async (data) => {
      await apiPost<void>('/auth/reset-password', data);
    },
    onSuccess: (_data, variables) => callbacks.onSuccess?.(variables),
    ...optionalOnError(callbacks),
  });
}
