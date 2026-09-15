/**
 * Camada de dados da tela de usuarios: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais o reset administrativo de senha e as duas colecoes que
 * alimentam os seletores — papeis e unidades —, escritos como hooks comuns
 * porque a fabrica so expoe as seis operacoes do roteador compartilhado.
 *
 * **Nada aqui e escopado por condominio.** `/users` e por tenant:
 * `UserRepository` nao declara `condominiumField` e sua whitelist de filtros nao
 * inclui `condominiumId`. Mandar a chave nao escoparia nada — seria descartada
 * em silencio — e prometeria um recorte inexistente. As colecoes auxiliares
 * seguem a mesma regra pelo mesmo motivo: a tela precisa funcionar com ou sem
 * condominio escolhido no shell.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGetPaginated, apiPost, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Unit } from '@/types/api';
import type { Role } from '@/types/role';
import type { PasswordReset, User } from '@/types/user';
import type { UserPayload } from './user-schema';

export const USERS_KEY = 'users';

/**
 * Whitelist de filtros do `UserRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 *
 * Note a ausencia de `condominiumId`: nao e um esquecimento, e o contrato.
 */
export const userFilters = ['status', 'roleId', 'unitId'] as const;

export const userHooks = createResourceHooks<User, UserPayload, Partial<UserPayload>>(USERS_KEY);

/**
 * Papeis de acesso, de `GET /roles` — CRUD padrao, consumido so para o seletor.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, ordenada por nome, e nao uma pagina navegavel. Nao ha tela de
 * papeis nesta entrega, e a chave propria evita que uma eventual venha a
 * invalidar a listagem de usuarios sem querer.
 */
export function useRoleOptions(): UseQueryResult<Paginated<Role>, ApiError> {
  return useQuery<Paginated<Role>, ApiError>({
    queryKey: ['roles', 'options'],
    queryFn: () =>
      apiGetPaginated<Role>('/roles', {
        params: { perPage: MAX_PER_PAGE, sortBy: 'name', sortOrder: 'ASC' },
      }),
  });
}

/**
 * Unidades do tenant inteiro, para o filtro e para nomear a unidade na listagem.
 *
 * Sem `condominiumId`: esta tela nao segue o condominio do shell, e a resposta
 * de `/users` pode trazer moradores de qualquer predio. O servidor ja restringe
 * a consulta aos condominios visiveis para quem pediu (`BaseRepository.baseQuery`
 * cruza o escopo do token), entao a colecao nunca extrapola o que o usuario
 * pode ver.
 *
 * A unidade vem eager com bloco e condominio, o que permite rotular a opcao sem
 * uma segunda consulta — necessario porque numeros de unidade se repetem entre
 * predios.
 */
export function useUnitOptions(): UseQueryResult<Paginated<Unit>, ApiError> {
  return useQuery<Paginated<Unit>, ApiError>({
    queryKey: ['units', 'tenant-options'],
    queryFn: () =>
      apiGetPaginated<Unit>('/units', {
        params: { perPage: MAX_PER_PAGE, sortBy: 'number', sortOrder: 'ASC' },
      }),
  });
}

/** "101 · Torre A · Residencial Aurora" — o que basta para escolher sem ambiguidade. */
export function unitLabel(unit: Unit): string {
  return [unit.number, unit.block?.name, unit.condominium?.name].filter(Boolean).join(' · ');
}

export type ResetPasswordVariables = { id: string };

export type ResetPasswordCallbacks = {
  onError?: (error: ApiError, variables: ResetPasswordVariables) => void;
  onSuccess?: (data: PasswordReset, variables: ResetPasswordVariables) => void;
};

/**
 * Reset administrativo de senha. Exige **`user:manage`**, e nao `update`
 * (ADR-002): um papel que corrige um telefone nao necessariamente pode derrubar
 * as sessoes de outra pessoa.
 *
 * O corpo vai vazio de proposito. `adminResetPasswordSchema` aceita uma senha
 * escolhida, mas a tela nao a oferece — exibir ou digitar senha em texto e
 * justamente o que o reset existe para evitar. Sem ela o servidor gera uma
 * temporaria, invalida as sessoes ativas e exige a troca no proximo acesso; a
 * senha volta **uma unica vez**, porque so o hash e guardado.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5, e
 * o toast sumiria sem nada no lugar.
 */
export function useResetUserPassword(
  callbacks: ResetPasswordCallbacks = {},
): UseMutationResult<PasswordReset, ApiError, ResetPasswordVariables> {
  const queryClient = useQueryClient();

  return useMutation<PasswordReset, ApiError, ResetPasswordVariables>({
    mutationFn: ({ id }) => apiPost<PasswordReset>(`/users/${id}/reset-password`, {}),
    onSuccess: (data, variables) => {
      // `mustChangePassword` muda no servidor; a lista precisa acompanhar.
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
