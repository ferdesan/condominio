/**
 * Rotulos de comunicado, compartilhados pela listagem, os filtros e o
 * formulario.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao exportada
 * junto de um componente levanta `react-refresh/only-export-components`, o que ja
 * aconteceu em correspondencias.
 */

import type {
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementStatus,
} from '@/types/announcement';

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  GENERAL: 'Geral',
  URGENT: 'Urgente',
  MAINTENANCE: 'Manutenção',
  FINANCIAL: 'Financeiro',
  EVENT: 'Evento',
  ASSEMBLY: 'Assembleia',
};

/**
 * Os rotulos do ciclo editorial.
 *
 * "Rascunho", "Publicado" e "Arquivado" nao colidem com nenhum cabecalho de
 * coluna nem com os verbos das acoes ("Publicar", "Arquivar"), que e a colisao
 * que ja quebrou consultas por texto em duas telas anteriores.
 */
export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Arquivado',
};

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  ALL: 'Todos',
  OWNERS: 'Proprietários',
  TENANTS: 'Inquilinos',
  STAFF: 'Funcionários',
  BLOCKS: 'Blocos especificos',
};

/** Rotulo do controle de fixados, que o servidor filtra por booleano. */
export const PINNED_LABELS: Record<'true' | 'false', string> = {
  true: 'Somente fixados',
  false: 'Somente não fixados',
};

/** Dito quando o servidor nao guardou o nome de quem publicou. */
export const NO_AUTHOR = 'Autor não registrado';
