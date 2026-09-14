/**
 * Camada de dados da tela de veiculos: a fabrica do ADR-008 mais os seletores de
 * unidade e de morador, que sao consultas comuns escritas ao lado da feature.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Resident, Unit, Vehicle } from '@/types/api';
import type { VehiclePayload } from './vehicle-schema';

/**
 * Whitelist de filtros do `VehicleRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const vehicleFilters = [
  'condominiumId',
  'unitId',
  'residentId',
  'type',
  'status',
] as const;

export const vehicleHooks = createResourceHooks<Vehicle, VehiclePayload, Partial<VehiclePayload>>(
  'vehicles',
);

/**
 * Unidades do condominio selecionado, para o seletor do formulario e para o
 * filtro da listagem.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer aqui e a colecao
 * inteira de uma vez, ordenada por numero, e nao uma pagina navegavel. Pedir o
 * teto do servidor evita paginar um seletor.
 */
export function useUnitOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<Unit>, ApiError> {
  return useQuery<Paginated<Unit>, ApiError>({
    queryKey: ['units', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<Unit>('/units', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'number',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}

/**
 * Moradores do condominio selecionado, pelo mesmo motivo e com a mesma forma.
 *
 * O vinculo com morador e independente do vinculo com unidade: o servidor nao
 * exige que um implique o outro, entao o seletor oferece todos os moradores do
 * condominio e nao apenas os da unidade escolhida.
 */
export function useResidentOptions(
  condominiumId: string | null,
): UseQueryResult<Paginated<Resident>, ApiError> {
  return useQuery<Paginated<Resident>, ApiError>({
    queryKey: ['residents', 'options', condominiumId],
    queryFn: () =>
      apiGetPaginated<Resident>('/residents', {
        params: {
          perPage: MAX_PER_PAGE,
          condominiumId: condominiumId ?? '',
          sortBy: 'name',
          sortOrder: 'ASC',
        },
      }),
    enabled: Boolean(condominiumId),
  });
}
