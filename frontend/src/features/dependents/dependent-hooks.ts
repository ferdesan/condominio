/**
 * Camada de dados da tela de dependentes: a fabrica do ADR-008 mais o seletor de
 * moradores, que e uma consulta comum escrita ao lado da feature.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Dependent, Resident } from '@/types/api';
import type { DependentPayload } from './dependent-schema';

export const dependentHooks = createResourceHooks<
  Dependent,
  DependentPayload,
  Partial<DependentPayload>
>('dependents');

/**
 * Whitelist do `DependentRepository`. Um filtro fora dela o backend descarta em
 * silencio, e o controle pareceria funcionar sem fazer nada — por isso nada fora
 * desta lista pode virar controle na tela.
 *
 * Vive aqui, e nao em `lib/crud/query-params.ts`, porque aquela camada e
 * compartilhada e nao muda por causa de uma tela nova.
 */
export const dependentFilters = [
  'condominiumId',
  'unitId',
  'residentId',
  'relationship',
  'active',
] as const;

/**
 * `active` e uma coluna booleana — `tinyint(1)` no MySQL. O filtro chega como
 * texto e vira `dependent.active = 'valor'`: o MySQL converte `'true'` para `0`
 * ao comparar com um numero, entao mandar `'true'` traria justamente os
 * inativos. `'1'` e `'0'` comparam certo nos dois bancos usados aqui.
 */
export const ACTIVE_FILTER_VALUES = { yes: '1', no: '0' } as const;

/**
 * Moradores do condominio selecionado, para o seletor do formulario e para os
 * filtros da listagem.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer e a colecao inteira
 * de uma vez, ordenada por nome, e nao uma pagina navegavel. Pedir o teto do
 * servidor evita paginar um seletor.
 *
 * A resposta ja traz a unidade de cada morador embutida, e e dai que sai tanto o
 * preenchimento da unidade no formulario quanto a lista de unidades do filtro:
 * a unidade de um dependente e sempre a do morador dele, entao uma unidade sem
 * morador nao tem dependente para filtrar.
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
