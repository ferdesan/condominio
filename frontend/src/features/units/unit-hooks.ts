/**
 * Camada de dados da tela de unidades: a fabrica do ADR-008 mais o unico
 * endpoint proprio do recurso, `POST /units/bulk`.
 *
 * Blocos saiam daqui quando ganharam rota propria; quem os le agora e
 * `features/blocks/block-hooks.ts`, inclusive a gestao embutida nesta tela.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiPost, type ApiError } from '@/lib/api';
import { createResourceHooks } from '@/lib/crud';
import type { Unit } from '@/types/api';
import type { BulkGeneratePayload } from './bulk-generate-schema';
import type { UnitPayload } from './unit-schema';

export const UNITS_KEY = ['units'] as const;

export const unitHooks = createResourceHooks<Unit, UnitPayload, Partial<UnitPayload>>('units');

export type BulkGenerateResult = { created: number };

/**
 * Geracao em lote. Fica fora da fabrica de proposito: ela so expoe as seis
 * operacoes do roteador CRUD compartilhado (ADR-008).
 *
 * A resposta traz apenas quantas unidades foram criadas, que pode ser menos do
 * que o pedido — numeros ja existentes sao pulados em silencio. Quando todos ja
 * existem o servidor recusa com 409 em vez de responder zero; quem apresenta
 * isso como desfecho, e nao como falha, e o dialogo.
 */
export function useBulkCreateUnits(callbacks: {
  onSuccess?: (result: BulkGenerateResult) => void;
  onError?: (error: ApiError) => void;
}): UseMutationResult<BulkGenerateResult, ApiError, BulkGeneratePayload> {
  const queryClient = useQueryClient();

  return useMutation<BulkGenerateResult, ApiError, BulkGeneratePayload>({
    mutationFn: (payload) => apiPost<BulkGenerateResult>('/units/bulk', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      callbacks.onSuccess?.(result);
    },
    // Sempre presente: o dialogo apresenta a recusa por si, e um `onError`
    // ausente deixaria o toast global duplicar a mensagem.
    onError: (error) => {
      // O lote roda em transacao, mas uma conexao perdida no meio deixa o
      // desfecho indefinido para quem enviou: so a lista recarregada diz o que
      // existe de fato.
      queryClient.invalidateQueries({ queryKey: UNITS_KEY });
      callbacks.onError?.(error);
    },
  });
}
