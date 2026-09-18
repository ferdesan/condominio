/**
 * Camada de dados do modulo LGPD.
 *
 * Os endpoints de LGPD nao passam pelo roteador CRUD compartilhado (ADR-008):
 * cada um tem o proprio verbo e significado, entao sao escritos como hooks
 * ao lado da feature, como o seletor de unidades faz com `/units`.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPost, type ApiError, type Paginated } from '@/lib/api';
import { toQueryParams, type ListParams } from '@/lib/crud';
import type { MutationCallbacks } from '@/lib/crud';
import type {
  CreateDeleteRequestResult,
  ExecuteDeleteResult,
  LgpdConsent,
  LgpdExportPayload,
  LgpdRequestView,
} from '@/types/lgpd';
import type { CreateDeleteRequestValues, UpdateConsentValues } from './lgpd-schema';

export const LGPD_REQUEST_KEY = ['lgpd-requests'] as const;
export const LGPD_CONSENT_KEY = ['lgpd-consents'] as const;

const CONSENT_TYPE = 'DATA_PROCESSING';

/** Mutacoes invalidam a colecao afetada, trazendo a lista ja atualizada. */
function withInvalidation<TData, TVariables>(
  invalidate: () => void,
  callbacks: MutationCallbacks<TData, TVariables>,
) {
  return {
    onSuccess: (data: TData, variables: TVariables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  };
}

function useInvalidate(keys: readonly (readonly unknown[])[]): () => void {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
  };
}

export function useDeleteRequests(
  params: ListParams,
  options: { enabled?: boolean } = {},
): UseQueryResult<Paginated<LgpdRequestView>, ApiError> {
  return useQuery<Paginated<LgpdRequestView>, ApiError>({
    queryKey: ['lgpd-requests', 'list', params],
    queryFn: () =>
      apiGetPaginated<LgpdRequestView>('/lgpd/delete-requests', {
        params: toQueryParams(params),
      }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useCreateDeleteRequest(
  callbacks: MutationCallbacks<CreateDeleteRequestResult, CreateDeleteRequestValues> = {},
) {
  const invalidate = useInvalidate([LGPD_REQUEST_KEY]);
  return useMutation<CreateDeleteRequestResult, ApiError, CreateDeleteRequestValues>({
    mutationFn: (body) => apiPost<CreateDeleteRequestResult>('/lgpd/delete-request', body),
    ...withInvalidation(invalidate, callbacks),
  });
}

export function useExecuteDeleteRequest(
  callbacks: MutationCallbacks<ExecuteDeleteResult, string> = {},
) {
  const invalidate = useInvalidate([LGPD_REQUEST_KEY]);
  return useMutation<ExecuteDeleteResult, ApiError, string>({
    mutationFn: (id) => apiPost<ExecuteDeleteResult>(`/lgpd/delete-request/${id}/execute`),
    ...withInvalidation(invalidate, callbacks),
  });
}

export function useCancelDeleteRequest(callbacks: MutationCallbacks<LgpdRequestView, string> = {}) {
  const invalidate = useInvalidate([LGPD_REQUEST_KEY]);
  return useMutation<LgpdRequestView, ApiError, string>({
    mutationFn: (id) => apiPost<LgpdRequestView>(`/lgpd/delete-request/${id}/cancel`),
    ...withInvalidation(invalidate, callbacks),
  });
}

export function useMyConsent(
  options: { enabled?: boolean } = {},
): UseQueryResult<LgpdConsent, ApiError> {
  return useQuery<LgpdConsent, ApiError>({
    queryKey: ['lgpd-consents', 'my', CONSENT_TYPE],
    queryFn: () => apiGet<LgpdConsent>('/lgpd/consent', { params: { consentType: CONSENT_TYPE } }),
    enabled: options.enabled ?? true,
  });
}

export function useUpdateConsent(
  callbacks: MutationCallbacks<LgpdConsent, UpdateConsentValues> = {},
) {
  const invalidate = useInvalidate([LGPD_CONSENT_KEY]);
  return useMutation<LgpdConsent, ApiError, UpdateConsentValues>({
    mutationFn: (body) => apiPost<LgpdConsent>('/lgpd/consent', body),
    ...withInvalidation(invalidate, callbacks),
  });
}

/**
 * Baixa o payload no formato canônico de exportacao (ADR-002): um JSON cujo
 * nome segue `lgpd-export-{residentId}-{yyyy-MM-dd}.json`.
 */
function downloadPayload(payload: LgpdExportPayload): void {
  const residentId = typeof payload.resident?.id === 'string' ? payload.resident.id : 'usuario';
  const date = payload.exportDate.slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lgpd-export-${residentId}-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Exportacao dos dados do morador logado. */
export function useExportOwnData(callbacks: MutationCallbacks<void, void> = {}) {
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      const payload = await apiGet<LgpdExportPayload>('/lgpd/export');
      downloadPayload(payload);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/** Exportacao do morador escolhido, restrita a quem tem `lgpd-request:read`. */
export function useExportResidentData(
  callbacks: MutationCallbacks<void, string> = {},
): UseMutationResult<void, ApiError, string> {
  return useMutation<void, ApiError, string>({
    mutationFn: async (residentId) => {
      const payload = await apiGet<LgpdExportPayload>(`/lgpd/export/${residentId}`);
      downloadPayload(payload);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
