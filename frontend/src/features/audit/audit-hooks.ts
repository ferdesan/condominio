/**
 * Camada de dados da trilha de auditoria.
 *
 * **Nao usa a fabrica do ADR-008.** Ela expoe as seis operacoes do roteador CRUD
 * compartilhado, e cinco delas nao existem aqui: `audit.routes.ts` tem duas
 * rotas, ambas de leitura. Montar a fabrica so pela listagem deixaria
 * `useCreate`, `useUpdate`, `useRemove` e `useRestore` ao alcance de quem
 * escrever a proxima tela, apontando para endpoints que respondem 404 — e a
 * trilha e append-only por exigencia da LGPD (art. 37), nao por falta de
 * implementacao.
 *
 * **Nada aqui e escopado por condominio.** A trilha e por tenant: `AuditRepository`
 * nao declara `condominiumField`, e `condominiumId` nao esta entre os filtros
 * que ele aceita. Mandar a chave nao escoparia nada — seria descartada em
 * silencio — e prometeria um recorte inexistente.
 */

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGet, apiGetPaginated, type ApiError, type Paginated } from '@/lib/api';
import { toQueryParams, type ListParams } from '@/lib/crud';
import type { AuditLog } from '@/types/audit';

export const AUDIT_KEY = 'audit-logs';

/**
 * Whitelist de filtros do `AuditRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 *
 * `resourceId` esta no contrato mas nao vira controle: procurar o historico de
 * um registro pelo identificador cru e o que a rota por recurso faz melhor.
 */
export const auditFilters = ['action', 'resource', 'resourceId', 'userId'] as const;

/**
 * O backend aceita ordenar por filtravel + buscavel + os dois timestamps
 * (`BaseRepository.applySorting`). Buscaveis da trilha: `description`,
 * `resource` e `userName`.
 *
 * Note que `id`, `changes`, `ipAddress` e `requestId` ficam de fora: uma coluna
 * ordenavel por um deles seria descartada em silencio e o servidor voltaria para
 * `createdAt DESC` sem avisar.
 */
export const auditSortable = [
  ...auditFilters,
  'description',
  'userName',
  'createdAt',
  'updatedAt',
] as const;

/**
 * A lista geral, paginada.
 *
 * `placeholderData` segura as linhas anteriores enquanto a proxima pagina nao
 * chega: sem isso a tabela esvazia e a paginacao some a cada tecla digitada na
 * busca.
 */
export function useAuditList(
  params: ListParams,
  options: { enabled?: boolean } = {},
): UseQueryResult<Paginated<AuditLog>, ApiError> {
  return useQuery<Paginated<AuditLog>, ApiError>({
    queryKey: [AUDIT_KEY, 'list', params],
    queryFn: () => apiGetPaginated<AuditLog>('/audit-logs', { params: toQueryParams(params) }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/**
 * O historico de um registro especifico, de `GET /audit-logs/:resource/:resourceId`.
 *
 * Nao e uma listagem paginada: o servidor devolve um **array cru**, ja ordenado
 * por `createdAt DESC` e limitado a cem entradas (`findAllBy`). O recorte e dele
 * e nao se refaz no cliente.
 *
 * A chave comeca com o recurso para que ela acompanhe qualquer invalidacao da
 * trilha; fica desligada enquanto nao houver alvo, porque uma acao sem
 * `resourceId` — uma tentativa de login, por exemplo — nao tem historico que
 * consultar.
 */
export function useResourceHistory(
  resource: string | null,
  resourceId: string | null,
): UseQueryResult<AuditLog[], ApiError> {
  return useQuery<AuditLog[], ApiError>({
    queryKey: [AUDIT_KEY, 'history', resource, resourceId],
    queryFn: () =>
      apiGet<AuditLog[]>(
        `/audit-logs/${encodeURIComponent(resource ?? '')}/${encodeURIComponent(resourceId ?? '')}`,
      ),
    enabled: Boolean(resource) && Boolean(resourceId),
  });
}
