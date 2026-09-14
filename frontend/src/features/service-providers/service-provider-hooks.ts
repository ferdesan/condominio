/**
 * Camada de dados da tela de prestadores: a fabrica do ADR-008 mais o seletor de
 * tipos de servico, que e uma consulta comum escrita ao lado da feature.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { ServiceProvider } from '@/types/api';
import type { ServiceProviderPayload } from './service-provider-schema';

/**
 * Whitelist de filtros do `ServiceProviderRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const serviceProviderFilters = ['condominiumId', 'status', 'serviceType'] as const;

export const serviceProviderHooks = createResourceHooks<
  ServiceProvider,
  ServiceProviderPayload,
  Partial<ServiceProviderPayload>
>('service-providers');

/**
 * Tipos de servico ja cadastrados no condominio, para o filtro da listagem.
 *
 * O servidor compara `serviceType` por igualdade, e nao por trecho: um campo de
 * texto livre recusaria "eletric" sem explicar por que, enquanto a busca — que
 * cobre o mesmo campo com `LIKE` — aceitaria. Oferecer as opcoes que existem
 * elimina a armadilha.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, e nao uma pagina navegavel. A chave comeca com o mesmo prefixo da
 * listagem, entao toda mutacao ja a invalida e um tipo recem-cadastrado aparece.
 */
export function useServiceTypeOptions(
  condominiumId: string | null,
): UseQueryResult<string[], ApiError> {
  return useQuery<Paginated<ServiceProvider>, ApiError, string[]>({
    queryKey: ['service-providers', 'service-types', condominiumId],
    queryFn: () =>
      apiGetPaginated<ServiceProvider>('/service-providers', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'serviceType',
          sortOrder: 'ASC',
        },
      }),
    select: distinctServiceTypes,
    enabled: Boolean(condominiumId),
  });
}

/**
 * Fora do componente de proposito: o React Query memoriza o resultado de
 * `select` pela identidade da funcao, e uma seta declarada na chamada seria
 * outra a cada render — refazendo a lista e devolvendo um array novo, que
 * atravessaria os `useMemo` de quem a consome.
 */
function distinctServiceTypes(page: Paginated<ServiceProvider>): string[] {
  return [...new Set(page.data.map((provider) => provider.serviceType))];
}
