/**
 * Espelha `backend/src/modules/audit/audit-log.entity.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `user.ts`: `api.ts` e compartilhado entre
 * as tasks deste tier e ja foi ponto de quebra.
 *
 * **Este recurso nao e escopado por condominio e nao tem escrita.**
 * `audit.routes.ts` expoe duas leituras e nada mais: a trilha e append-only por
 * exigencia da LGPD (art. 37) e da prestacao de contas do condominio. Nao
 * existe criar, editar, excluir nem restaurar — nem no servidor, nem na tela.
 */

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
  'PERMISSION_DENIED',
  'EXPORT',
  'IMPORT',
  'LGPD_DELETE_REQUEST',
  'LGPD_DELETE',
  'LGPD_DELETE_CANCEL',
  'LGPD_EXPORT',
  'LGPD_CONSENT_GRANTED',
  'LGPD_CONSENT_REVOKED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * O antes e o depois de uma alteracao, ja recortados pelo servidor.
 *
 * `diffChanges` guarda somente as propriedades que de fato mudaram, e
 * `maskSensitive` troca senha e token por `***` antes de persistir — o que
 * chega aqui ja e o conteudo legivel da mudanca, e nao a entidade inteira.
 *
 * Ambos os lados sao ausentes nas acoes que nao alteram registro (login,
 * permissao negada), e `before` tambem e ausente numa criacao.
 */
export type AuditChanges = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export type AuditLog = {
  id: string;
  /** Ausente quando quem agiu foi o proprio sistema (jobs, seeds). */
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  /** Nome do recurso como o backend o registra: `unit`, `reservation`, ... */
  resource: string;
  /** Ausente em acoes que nao tem alvo — uma tentativa de login, por exemplo. */
  resourceId: string | null;
  description: string | null;
  changes: AuditChanges | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Presente no contrato porque toda entidade herda a coluna, e sempre nulo: a
   * aplicacao nunca remove uma entrada da trilha.
   */
  deletedAt: string | null;
};
