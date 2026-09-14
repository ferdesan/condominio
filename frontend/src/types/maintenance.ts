/**
 * Espelha `backend/src/modules/maintenances/maintenance.entity.ts` e o contrato
 * de `maintenance.schema.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `incident.ts`: `api.ts` e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra.
 */

export const MAINTENANCE_TYPES = [
  'PREVENTIVE',
  'CORRECTIVE',
  'EMERGENCY',
  'INSPECTION',
] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

/**
 * Os cinco estados de uma ordem.
 *
 * `OVERDUE` nao e um destino escolhido por ninguem: um job diario
 * (`MaintenanceRepository.markOverdue`) move para ele o que estava agendado e
 * venceu. Para as tres acoes de fluxo o servidor o trata igual a `SCHEDULED` —
 * iniciar e cancelar sao aceitos —, e e assim que a tela o oferece.
 */
export const MAINTENANCE_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELED',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_RECURRENCES = [
  'NONE',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const;
export type MaintenanceRecurrence = (typeof MAINTENANCE_RECURRENCES)[number];

export type Maintenance = {
  id: string;
  condominiumId: string;
  title: string;
  description: string | null;
  type: MaintenanceType;
  status: MaintenanceStatus;
  recurrence: MaintenanceRecurrence;
  /** Ativo ou local, ex.: "Elevador Social - Torre A". */
  assetName: string | null;
  serviceProviderId: string | null;
  responsibleId: string | null;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Data (`YYYY-MM-DD`): o backend expoe a coluna `date` como string. */
  nextExecutionAt: string | null;
  estimatedCost: number;
  finalCost: number | null;
  attachments: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Corpo de `POST /maintenances/:id/complete`.
 *
 * Nao e a ordem concluida sozinha: o servico devolve tambem o id da proxima
 * ordem, que ele abre automaticamente quando a manutencao e recorrente —
 * preventivas obrigatorias nao podem depender de alguem lembrar de reagendar.
 * `nextId` e nulo quando a recorrencia e `NONE`.
 */
export type CompletedMaintenance = {
  maintenance: Maintenance;
  nextId: string | null;
};
