/**
 * Espelha `backend/src/modules/notifications/notification.entity.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `audit.ts`: `api.ts` e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra.
 *
 * **A central e sempre pessoal.** `notification.routes.ts` injeta o usuario da
 * sessao em toda leitura, entao nem a listagem nem a contagem aceitam um
 * destinatario vindo do cliente. Nao ha criacao pela interface: as notificacoes
 * sao geradas pelo servidor a partir de eventos de negocio.
 */

export const NOTIFICATION_TYPES = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR',
  'ANNOUNCEMENT',
  'CHARGE',
  'RESERVATION',
  'CORRESPONDENCE',
  'INCIDENT',
  'ASSEMBLY',
  'VISITOR',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Nome prefixado de proposito: `Notification` e um tipo global do DOM, e um
 * modulo que esquecesse o import compilaria contra a notificacao do navegador
 * sem nenhum erro — o pior tipo de divergencia, porque nao aparece no type
 * check.
 */
export type AppNotification = {
  id: string;
  /** Sempre o usuario da sessao: o servidor nao serve as de outra pessoa. */
  userId: string;
  /** Ausente nas notificacoes que valem para o tenant inteiro. */
  condominiumId: string | null;
  title: string;
  message: string;
  type: NotificationType;
  /** Recurso que originou o evento: `reservation`, `correspondence`, ... */
  resource: string | null;
  resourceId: string | null;
  /**
   * Caminho da tela de origem, gravado pelo servidor.
   *
   * Pode apontar para rota que a aplicacao nao tem — as notificacoes de reserva
   * gravam `/reservas/{id}` e, por ADR-004, nao existe rota de detalhe de
   * reserva. Resolver isso e papel de `features/notifications/notification-links.ts`.
   */
  actionUrl: string | null;
  /** Ausente enquanto nao lida; e o unico sinal de leitura que existe. */
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Corpo de `GET /notifications/unread-count`. */
export type NotificationUnreadCount = {
  unread: number;
};

/** Corpo de `POST /notifications/read`: quantas entradas mudaram de estado. */
export type NotificationReadResult = {
  updated: number;
};
