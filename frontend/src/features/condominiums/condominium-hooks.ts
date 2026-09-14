/**
 * Camada de dados da tela de condominios: a fabrica do ADR-008 mais o unico
 * endpoint proprio do recurso, `/:id/stats`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGet, type ApiError } from '@/lib/api';
import { createResourceHooks } from '@/lib/crud';
import type { Condominium, CondominiumStats } from '@/types/api';
import type { CondominiumPayload } from './condominium-schema';

/**
 * Chave que o seletor do shell usa (`providers/condominium-provider.tsx`). Ele le
 * a mesma colecao desta tela, entao toda mutacao daqui precisa invalida-la — sem
 * isso o seletor mostra um condominio que nao existe mais, ou nao mostra o que
 * acabou de ser criado.
 */
export const CONDOMINIUM_OPTIONS_KEY = ['condominiums', 'options'] as const;

export const condominiumHooks = createResourceHooks<
  Condominium,
  CondominiumPayload,
  Partial<CondominiumPayload>
>('condominiums', { extraInvalidate: [CONDOMINIUM_OPTIONS_KEY] });

/**
 * Os sete contadores da tela de detalhe. Fica fora da fabrica de proposito: ela
 * so expoe as seis operacoes do roteador CRUD compartilhado (ADR-008).
 *
 * Consulta separada da do registro para que uma falha aqui nao leve a pagina
 * junto — o cadastro continua legivel sem os indicadores.
 */
export function useCondominiumStats(id: string | null): UseQueryResult<CondominiumStats, ApiError> {
  return useQuery<CondominiumStats, ApiError>({
    queryKey: ['condominiums', 'stats', id],
    queryFn: () => apiGet<CondominiumStats>(`/condominiums/${id}/stats`),
    enabled: Boolean(id),
  });
}
