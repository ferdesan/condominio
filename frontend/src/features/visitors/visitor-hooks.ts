/**
 * Camada de dados da tela de visitantes: a fabrica do ADR-008 para a superficie
 * CRUD uniforme, mais os quatro endpoints proprios do recurso — contagem de quem
 * esta dentro, consulta por codigo de acesso, entrada e saida — escritos como
 * hooks comuns, porque a fabrica so expoe as seis operacoes do roteador
 * compartilhado.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPost, type ApiError, type Paginated } from '@/lib/api';
import { createResourceHooks, MAX_PER_PAGE } from '@/lib/crud';
import type { Unit } from '@/types/api';
import type { Visitor, VisitorInsideCount } from '@/types/visitor';
import type { VisitorPayload } from './visitor-schema';

export const VISITORS_KEY = 'visitors';

/**
 * Whitelist de filtros do `VisitorRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado e nao muda nesta entrega. A regra que ela serve e a
 * mesma: o backend descarta em silencio o que estiver fora da lista, entao um
 * controle a mais pareceria funcionar sem filtrar nada.
 */
export const visitorFilters = [
  'condominiumId',
  'unitId',
  'status',
  'type',
  'authorizedById',
] as const;

export const visitorHooks = createResourceHooks<Visitor, VisitorPayload, Partial<VisitorPayload>>(
  VISITORS_KEY,
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
 * Quantos visitantes estao no condominio agora.
 *
 * Vem de `/visitors/inside-count`, e nao de `meta.total` de uma listagem
 * filtrada: e um endpoint dedicado, mais barato, e o corpo dele e um objeto —
 * `{ inside }` — e nao um numero solto. A chave comeca com o recurso, entao a
 * invalidacao das mutacoes e das acoes de fluxo ja a alcanca.
 */
export function useInsideCount(
  condominiumId: string | null,
  options: { enabled?: boolean } = {},
): UseQueryResult<number, ApiError> {
  return useQuery<number, ApiError>({
    queryKey: [VISITORS_KEY, 'inside-count', condominiumId],
    queryFn: async () => {
      const result = await apiGet<VisitorInsideCount>('/visitors/inside-count', {
        params: { condominiumId: condominiumId ?? '' },
      });
      return result.inside;
    },
    enabled: (options.enabled ?? true) && Boolean(condominiumId),
  });
}

/**
 * Consulta um visitante pelo codigo de acesso, sob demanda.
 *
 * **E uma mutacao, e nao uma consulta**, apesar de ser um `GET`. A diferenca
 * que importa aqui nao e o verbo HTTP: e que ela roda quando a portaria pede, e
 * nao quando a tela monta. Um `useQuery` guardaria o resultado por chave e
 * responderia a segunda digitacao do mesmo codigo com o cache — exatamente o
 * errado numa consulta cujo proposito e saber o estado **agora**.
 *
 * **Codigo nao encontrado chega como 409, e nao 404.**
 * `visitorService.findByAccessCode` lanca `BusinessRuleError` com "Codigo de
 * acesso invalido ou ja utilizado." — e a consulta so procura entre os
 * `EXPECTED`, entao um visitante que ja entrou tambem "nao existe" para ela.
 * Isso e um desfecho normal da portaria, e nao uma falha: quem chama trata o
 * 409 como resposta, e nao como erro.
 *
 * O servidor exige de 4 a 12 caracteres no parametro e normaliza para
 * maiusculas; o cliente faz o mesmo antes de enviar para que o codigo digitado
 * em minusculas nao vire um 409 desnecessario.
 */
export function useVisitorByAccessCode(
  callbacks: {
    onSuccess?: (visitor: Visitor) => void;
    onError?: (error: ApiError) => void;
  } = {},
): UseMutationResult<Visitor, ApiError, string> {
  return useMutation<Visitor, ApiError, string>({
    mutationFn: (code) =>
      apiGet<Visitor>(`/visitors/access-code/${encodeURIComponent(code.trim().toUpperCase())}`),
    onSuccess: (visitor) => callbacks.onSuccess?.(visitor),
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type FlowVariables = {
  id: string;
};

export type FlowCallbacks = {
  onError?: (error: ApiError, variables: FlowVariables) => void;
  onSuccess?: (data: Visitor, variables: FlowVariables) => void;
};

/**
 * Base das duas acoes de portaria. As duas postam um corpo opcional — a
 * portaria registra o momento, e cracha, placa e observacao continuam sendo
 * editados pelo formulario — e invalidam o recurso inteiro, entao a listagem e
 * a contagem de presentes saem juntas do ar.
 *
 * `onError` so entra no objeto quando quem chamou informou um: escrever
 * `onError: undefined` tambem substituiria o handler global do React Query v5,
 * e o toast sumiria sem nada no lugar.
 */
function useVisitorFlow(
  action: 'check-in' | 'check-out',
  callbacks: FlowCallbacks = {},
): UseMutationResult<Visitor, ApiError, FlowVariables> {
  const queryClient = useQueryClient();

  return useMutation<Visitor, ApiError, FlowVariables>({
    mutationFn: ({ id }) => apiPost<Visitor>(`/visitors/${id}/${action}`, {}),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [VISITORS_KEY] });
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Entrada registrada pela portaria. Exige `visitor:update`. */
export function useCheckInVisitor(callbacks?: FlowCallbacks) {
  return useVisitorFlow('check-in', callbacks);
}

/** Saida registrada pela portaria. Exige a mesma permissao da entrada. */
export function useCheckOutVisitor(callbacks?: FlowCallbacks) {
  return useVisitorFlow('check-out', callbacks);
}
