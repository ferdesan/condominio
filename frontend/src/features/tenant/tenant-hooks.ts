/**
 * Camada de dados da administradora.
 *
 * **Nao usa a fabrica do ADR-008.** Ela monta as seis operacoes do roteador CRUD
 * sobre um recurso com `:id`; aqui o alvo e sempre o tenant da sessao. O
 * servidor ate expoe `/tenants` com listagem e CRUD por id, mas as tres rotas
 * de colecao exigem `requireSuperAdmin` — um back-office de administradora
 * nunca as alcanca. Montar a fabrica deixaria as seis operacoes ao alcance de
 * quem escrever a proxima tela, apontando para rotas que respondem 403.
 *
 * Mesmo raciocinio ja escrito em `features/profile/profile-hooks.ts`, e a
 * mesma consequencia: `useQuery`/`useMutation` a mao, com o motivo no lugar.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiPatch, type ApiError } from '@/lib/api';
import type { Tenant } from '@/types/tenant';
import type { TenantPayload } from './tenant-schema';

export const TENANT_KEY = 'tenant';

/**
 * O cadastro da administradora da sessao. Exige `tenant:read`.
 *
 * A chave **nao** carrega o condominio selecionado: a resposta e do tenant e
 * nao varia com ele. Inclui-la refaria a busca a cada troca no shell,
 * prometendo uma variacao que nao existe — o mesmo motivo pelo qual a contagem
 * de nao lidas da central de notificacoes tambem nao o carrega.
 */
export function useTenant(): UseQueryResult<Tenant, ApiError> {
  return useQuery<Tenant, ApiError>({
    queryKey: [TENANT_KEY, 'me'],
    queryFn: () => apiGet<Tenant>('/tenants/me'),
  });
}

export type UpdateTenantCallbacks = {
  onSuccess?: (data: Tenant) => void;
  onError?: (error: ApiError) => void;
};

/**
 * Salva o cadastro e a politica de encargos. Exige `tenant:update`.
 *
 * `settings` e **mesclado** no servidor (`{ ...current.settings, ...dto.settings }`),
 * entao enviar apenas os tres campos que a tela oferece preserva `timezone`,
 * `locale` e `primaryColor`, que ela nao oferece e nao deve apagar.
 *
 * A resposta e o tenant ja remontado; o cache recebe esse valor em vez de ser
 * invalidado, porque uma segunda ida a `/tenants/me` poderia responder antes da
 * primeira e restaurar o estado anterior.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5,
 * e o toast sumiria sem nada no lugar.
 */
export function useUpdateTenant(
  callbacks: UpdateTenantCallbacks = {},
): UseMutationResult<Tenant, ApiError, TenantPayload> {
  const queryClient = useQueryClient();

  return useMutation<Tenant, ApiError, TenantPayload>({
    mutationFn: (data) => apiPatch<Tenant>('/tenants/me', data),
    onSuccess: (data) => {
      queryClient.setQueryData([TENANT_KEY, 'me'], data);
      callbacks.onSuccess?.(data);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
