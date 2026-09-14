/**
 * Espelha `backend/src/modules/documents/document.entity.ts`.
 *
 * Arquivo proprio pela regra registrada no cabecalho de `types/api.ts`: recurso
 * novo ganha `types/<recurso>.ts`.
 *
 * **Este recurso nao usa o roteador CRUD compartilhado.** `document.routes.ts`
 * declara as cinco rotas a mao — listar, enviar, ler, editar e excluir —, e a
 * criacao e **multipart**, nao JSON. Nao existe rota de restauracao: excluir
 * apaga o arquivo do disco (`afterRemove`), por exigencia de eliminacao do dado
 * da LGPD, e nao ha o que restaurar depois.
 */

export const DOCUMENT_CATEGORIES = [
  'CONVENTION',
  'REGULATION',
  'MINUTES',
  'CONTRACT',
  'FINANCIAL',
  'REPORT',
  'INSURANCE',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/**
 * Quem enxerga o documento no portal.
 *
 * A regra vale no download, e nao na listagem: `documentService.assertVisibility`
 * so roda em `prepareDownload`. Quem administra documentos (`document:manage`)
 * passa por todas.
 */
export const DOCUMENT_VISIBILITIES = ['PUBLIC', 'RESIDENTS', 'OWNERS', 'STAFF', 'ADMIN'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

/**
 * Nome prefixado de proposito, como o do proprio backend: `Document` e um tipo
 * global do DOM, e um modulo que esquecesse o import compilaria contra o
 * documento do navegador sem erro nenhum no type check.
 */
export type DocumentFile = {
  id: string;
  condominiumId: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  /** Nome original enviado; o nome em disco e outro, gerado pelo servidor. */
  fileName: string;
  /** Caminho relativo dentro do armazenamento do tenant. Nunca absoluto. */
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  uploadedById: string | null;
  /** Data (AAAA-MM-DD) a partir da qual o documento deixa de valer. */
  expiresAt: string | null;
  downloadsCount: number;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
