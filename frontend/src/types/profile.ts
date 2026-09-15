/**
 * Espelha as rotas autenticadas de `backend/src/modules/auth/auth.routes.ts` que
 * a propria pessoa usa sobre a propria conta: `PATCH /auth/me`,
 * `POST /auth/change-password`, `GET /auth/sessions` e `POST /auth/logout-all`.
 *
 * Arquivo proprio pela regra de `api.ts`: contrato novo nao entra la. O que
 * continua em `api.ts` e o `AuthUser`, que e o payload da sessao e nasceu antes
 * da regra — inclusive as `UserPreferences`, que chegam dentro dele.
 *
 * **Isto nao e a administracao de usuarios.** `/users` e por tenant, exige
 * `user:read` e permite trocar papel, status e vinculos; aqui nao ha permissao
 * nenhuma a conferir, porque o servidor deriva o alvo do token — uma pessoa
 * sempre pode editar o proprio cadastro, e nunca o de outra.
 */

/**
 * Uma sessao ativa, de `GET /auth/sessions`.
 *
 * Uma linha por refresh token nao revogado, no maximo vinte, da mais recente
 * para a mais antiga (`listActiveSessions`). O filtro e por `revokedAt` nulo e
 * **nao** por validade, entao uma sessao ja vencida ainda aparece ate a rotina
 * de limpeza passar — por isso `expiresAt` e mostrado, e nao escondido.
 *
 * `id` e a chave da linha; `sessionId` e o identificador logico do dispositivo,
 * exibido abreviado para que duas linhas do mesmo navegador se distingam.
 */
export type UserSession = {
  id: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};
