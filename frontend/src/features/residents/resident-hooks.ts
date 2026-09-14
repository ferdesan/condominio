/**
 * Camada de dados da tela de moradores: a fabrica do ADR-008 mais o seletor de
 * unidades, que e uma consulta comum escrita ao lado da feature.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Resident, Unit } from '@/types/api';
import type { ResidentPayload } from './resident-schema';

/**
 * Criar, alterar ou remover um morador faz o servidor recalcular o status da
 * unidade — ocupada com ao menos um morador ativo, vaga sem nenhum. A
 * consequencia mora em outra colecao, entao invalidar so `['residents']`
 * deixaria a tela de unidades mostrando uma ocupacao que ja mudou.
 */
export const UNITS_KEY = ['units'] as const;

export const residentHooks = createResourceHooks<
  Resident,
  ResidentPayload,
  Partial<ResidentPayload>
>('residents', { extraInvalidate: [UNITS_KEY] });

/**
 * Unidades do condominio selecionado, para o seletor do formulario e para o
 * filtro da listagem.
 *
 * Fica fora da fabrica de proposito (ADR-008): o que se quer aqui e a colecao
 * inteira de uma vez, ordenada por numero, e nao uma pagina navegavel. Pedir o
 * teto do servidor evita paginar um seletor.
 *
 * Enquanto a tela de unidades da tarefa 4 nao existe, esta e a unica leitura de
 * `/units` no cliente; quando existir, as duas compartilham o prefixo de chave
 * e portanto a mesma invalidacao.
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
