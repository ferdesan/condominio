/**
 * Camada de dados do acervo de documentos.
 *
 * **Nao usa a fabrica do ADR-008.** Ela assume o roteador CRUD compartilhado, e
 * `document.routes.ts` declara as cinco rotas a mao: a criacao e multipart e nao
 * JSON, e nao existe `/restore` — excluir apaga o arquivo do disco. Montar a
 * fabrica aqui ofereceria `useCreate` com o corpo errado e `useRestore`
 * apontando para uma rota inexistente.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  api,
  apiDelete,
  ApiError,
  apiGetPaginated,
  apiPatch,
  apiPost,
  type Paginated,
} from '@/lib/api';
import { toQueryParams, type ListParams } from '@/lib/crud';
import type { DocumentFile } from '@/types/document';
import type { DocumentMetadataPayload } from './document-schema';

export const DOCUMENTS_KEY = 'documents';

/**
 * Whitelist de filtros do `DocumentRepository`.
 *
 * Mora aqui, e nao junto das demais em `lib/crud/query-params.ts`, porque aquele
 * modulo e compartilhado. A regra que ela serve e a mesma: o backend descarta em
 * silencio o que estiver fora da lista, entao um controle a mais pareceria
 * funcionar sem filtrar nada.
 */
export const documentFilters = ['condominiumId', 'category', 'visibility'] as const;

/**
 * O backend aceita ordenar por filtravel + buscavel + os dois timestamps.
 * Buscaveis: `title`, `description` e `fileName`.
 *
 * Note a ausencia de `sizeBytes`, `downloadsCount` e `expiresAt`: colunas
 * ordenaveis por eles seriam descartadas em silencio e a ordem voltaria para
 * `createdAt DESC`.
 */
export const documentSortable = [
  'condominiumId',
  'category',
  'visibility',
  'title',
  'description',
  'fileName',
  'createdAt',
  'updatedAt',
] as const;

export function useDocumentList(
  params: ListParams,
  options: { enabled?: boolean } = {},
): UseQueryResult<Paginated<DocumentFile>, ApiError> {
  return useQuery<Paginated<DocumentFile>, ApiError>({
    queryKey: [DOCUMENTS_KEY, 'list', params],
    queryFn: () => apiGetPaginated<DocumentFile>('/documents', { params: toQueryParams(params) }),
    enabled: options.enabled ?? true,
    // Segura as linhas anteriores enquanto a proxima pagina nao chega: sem isso
    // a tabela esvazia e a paginacao some a cada tecla digitada na busca.
    placeholderData: keepPreviousData,
  });
}

export type MutationCallbacks<TData, TVariables> = {
  onError?: (error: ApiError, variables: TVariables) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
};

/** Invalida o recurso inteiro: a lista e a unica consulta que existe aqui. */
function useInvalidate(): () => void {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [DOCUMENTS_KEY] });
}

/**
 * Envio do arquivo. `POST /documents` e multipart.
 *
 * O `Content-Type` precisa ser anunciado aqui. A instancia de `lib/api.ts` traz
 * `application/json` fixo, e o `transformRequest` do axios serializa o
 * `FormData` para JSON quando encontra esse cabecalho — o servidor receberia um
 * corpo JSON, o multer nao acharia arquivo nenhum e a resposta seria
 * `400 Envie o arquivo no campo "file".`
 *
 * Declarar `multipart/form-data` sem `boundary` e o caminho suportado: o axios
 * deixa o `FormData` passar intacto e o adaptador do navegador reescreve o
 * cabecalho com o `boundary` na hora do envio, que e quando ele existe.
 */
export function useUploadDocument(
  callbacks: MutationCallbacks<DocumentFile, FormData> = {},
): UseMutationResult<DocumentFile, ApiError, FormData> {
  const invalidate = useInvalidate();

  return useMutation<DocumentFile, ApiError, FormData>({
    mutationFn: (data) =>
      apiPost<DocumentFile>('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

export type UpdateDocumentVariables = { id: string; data: DocumentMetadataPayload };

/** Edicao dos metadados. O arquivo nao muda: o servidor nao tem rota para isso. */
export function useUpdateDocument(
  callbacks: MutationCallbacks<DocumentFile, UpdateDocumentVariables> = {},
): UseMutationResult<DocumentFile, ApiError, UpdateDocumentVariables> {
  const invalidate = useInvalidate();

  return useMutation<DocumentFile, ApiError, UpdateDocumentVariables>({
    mutationFn: ({ id, data }) => apiPatch<DocumentFile>(`/documents/${id}`, data),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Exclusao. **Permanente**: `afterRemove` apaga o arquivo do disco, e nao existe
 * rota de restauracao — e a eliminacao do dado que a LGPD exige. Por isso esta
 * tela nao oferece "incluir removidos" nem "restaurar", ao contrario das demais
 * (ADR-006), e a confirmacao precisa dizer que nao ha volta.
 */
export function useRemoveDocument(
  callbacks: MutationCallbacks<void, string> = {},
): UseMutationResult<void, ApiError, string> {
  const invalidate = useInvalidate();

  return useMutation<void, ApiError, string>({
    mutationFn: (id) => apiDelete(`/documents/${id}`),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}

/**
 * Traduz a falha de um download para uma mensagem legivel.
 *
 * Existe porque `responseType: 'blob'` custa a mensagem do servidor: o corpo de
 * erro tambem chega como `Blob`, entao o interceptor do axios nao consegue ler
 * o envelope JSON e cai no texto generico ("Request failed with status code
 * 403"). O status sobrevive, e nas tres recusas que esta rota produz ele basta
 * para dizer o que aconteceu.
 *
 * Qualquer outro status mantem o erro original: inventar texto para um caso nao
 * previsto seria pior do que a mensagem generica.
 */
function describeDownloadFailure(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;

  const message =
    error.status === 403
      ? 'Este documento nao esta disponivel para o seu perfil.'
      : error.status === 404
        ? 'Documento nao encontrado. A lista pode estar desatualizada.'
        : error.status === 400
          ? 'O arquivo nao esta mais disponivel no armazenamento.'
          : null;

  if (!message) return error;
  return new ApiError(message, error.status, error.code, error.details);
}

/**
 * Baixa o arquivo.
 *
 * Nao e um link comum de proposito: a sessao viaja no cabecalho `Authorization`,
 * e uma navegacao do navegador nao o carrega — o download viraria um 401. Por
 * isso o arquivo vem pelo mesmo cliente das demais requisicoes, como `blob`, e
 * so entao e entregue ao navegador.
 *
 * `apiGet` nao serve aqui porque desembrulha `data.data` de um envelope JSON, e
 * esta rota devolve o arquivo cru.
 */
export async function downloadDocument(document: DocumentFile): Promise<void> {
  const response = await api.get<Blob>(`/documents/${document.id}/download`, {
    responseType: 'blob',
  }).catch((error: unknown) => {
    throw describeDownloadFailure(error);
  });

  const url = URL.createObjectURL(response.data);
  try {
    const anchor = window.document.createElement('a');
    anchor.href = url;
    // O nome original, e nao o do disco: o servidor guarda o arquivo com um uuid.
    anchor.download = document.fileName;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Sem isto o blob fica na memoria da aba ate ela ser fechada.
    URL.revokeObjectURL(url);
  }
}

/**
 * A contagem de downloads sobe no servidor a cada baixa, entao a lista precisa
 * ser reconsultada depois — senao a coluna mente ate o proximo refetch.
 */
export function useDownloadDocument(
  callbacks: MutationCallbacks<void, DocumentFile> = {},
): UseMutationResult<void, ApiError, DocumentFile> {
  const invalidate = useInvalidate();

  return useMutation<void, ApiError, DocumentFile>({
    mutationFn: (document) => downloadDocument(document),
    onSuccess: (data, variables) => {
      invalidate();
      callbacks.onSuccess?.(data, variables);
    },
    ...(callbacks.onError ? { onError: callbacks.onError } : {}),
  });
}
