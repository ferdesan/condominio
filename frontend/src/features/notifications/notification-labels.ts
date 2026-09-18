/**
 * Rotulos da central de notificacoes, compartilhados pela listagem, os filtros e
 * as acoes de linha.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { AppNotification, NotificationType } from '@/types/notification';

/**
 * Os onze tipos que o servidor grava.
 *
 * Nenhum rotulo repete um cabecalho de coluna ("Recebida", "Situacao",
 * "Assunto", "Mensagem", "Tipo", "Acoes") nem o rotulo de um filtro — a colisao
 * que ja quebrou consultas por texto em telas anteriores.
 */
export const TYPE_LABELS: Record<NotificationType, string> = {
  INFO: 'Informativo',
  SUCCESS: 'Confirmação',
  WARNING: 'Alerta',
  ERROR: 'Falha',
  ANNOUNCEMENT: 'Comunicado',
  CHARGE: 'Cobrança',
  RESERVATION: 'Reserva',
  CORRESPONDENCE: 'Correspondência',
  INCIDENT: 'Ocorrência',
  ASSEMBLY: 'Assembleia',
  VISITOR: 'Visitante',
};

/**
 * Os dois estados de leitura, no singular.
 *
 * O contador usa o plural ("Nao lidas") de proposito: o mesmo texto no rotulo da
 * linha e no titulo do indicador tornaria ambigua qualquer consulta por texto —
 * foi o que ja aconteceu entre um rotulo de status e o botao de um contador.
 */
export const READ_LABEL = 'Lida';
export const UNREAD_LABEL = 'Não lida';

/** Titulo do indicador; plural, e diferente de `UNREAD_LABEL` por isso. */
export const UNREAD_COUNT_LABEL = 'Não lidas';

/** Dito quando o `actionUrl` nao aponta para nenhuma tela existente. */
export const NO_DESTINATION = 'Sem tela de origem';

/** Identifica a notificacao nos rotulos acessiveis das acoes de linha. */
export function notificationLabel(notification: AppNotification): string {
  return notification.title;
}
