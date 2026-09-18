/**
 * Rotulos e limites do acervo de documentos, compartilhados pela listagem, os
 * filtros e o formulario.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { DocumentCategory, DocumentFile, DocumentVisibility } from '@/types/document';

/**
 * As oito categorias do acervo.
 *
 * Nenhum rotulo repete um cabecalho de coluna ("Documento", "Categoria",
 * "Quem ve", "Tamanho", "Validade", "Downloads", "Acoes") nem o rotulo de um
 * filtro — a colisao que ja quebrou consultas por texto em telas anteriores.
 */
export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONVENTION: 'Convenção',
  REGULATION: 'Regimento interno',
  MINUTES: 'Ata',
  CONTRACT: 'Contrato',
  FINANCIAL: 'Prestação de contas',
  REPORT: 'Laudo',
  INSURANCE: 'Apolice',
  OTHER: 'Outro',
};

/**
 * Quem enxerga cada documento.
 *
 * O texto diz o publico, e nao o nome tecnico do nivel: "Somente a
 * administracao" e verificavel por quem cadastra; "ADMIN" nao.
 */
export const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  PUBLIC: 'Qualquer pessoa',
  RESIDENTS: 'Moradores',
  OWNERS: 'Proprietários',
  STAFF: 'Funcionários',
  ADMIN: 'Somente a administração',
};

/**
 * Tipos aceitos por `upload.middleware.ts`.
 *
 * A lista e do servidor, e o `fileFilter` dele recusa o que estiver fora com um
 * 400. Repeti-la aqui serve ao atributo `accept` do seletor de arquivo, que
 * evita a viagem inutil — mas quem decide continua sendo o servidor.
 */
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

/** Valor do atributo `accept` do campo de arquivo. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');

/** Extensoes ditas por extenso na descricao do campo, que e o que o usuario reconhece. */
export const ACCEPTED_EXTENSIONS = 'PDF, Word, Excel, CSV, texto, JPG, PNG ou WebP';

/**
 * Teto de tamanho do servidor (`UPLOAD_MAX_SIZE_MB`, padrao 10 MB).
 *
 * Conferi-lo aqui evita enviar dez megabytes para receber um 413 — mas o valor
 * e configuravel por ambiente, entao a recusa do servidor continua sendo a
 * autoridade, e a mensagem dela aparece no formulario.
 */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Dito quando o documento nao tem prazo de validade. */
export const NO_EXPIRY = 'Sem validade definida';

/** Dito quando o documento nao tem marcadores. */
export const NO_TAGS = 'Sem marcadores';

/** Identifica o documento nos rotulos acessiveis das acoes de linha. */
export function documentLabel(document: DocumentFile): string {
  return document.title;
}

/** Um documento vencido continua no acervo; o que muda e o aviso na linha. */
export function isExpired(document: DocumentFile, now: Date = new Date()): boolean {
  if (!document.expiresAt) return false;
  // Comparacao por dia: `expiresAt` e uma data (AAAA-MM-DD), sem hora.
  return document.expiresAt < now.toISOString().slice(0, 10);
}
