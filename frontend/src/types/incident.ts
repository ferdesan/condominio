/**
 * Espelha `backend/src/modules/incidents/incident.entity.ts` e o contrato de
 * `incident.schema.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `announcement.ts`: `api.ts` e
 * compartilhado entre as tasks deste tier e ja foi ponto de quebra.
 */

export const INCIDENT_CATEGORIES = [
  'NOISE',
  'SECURITY',
  'MAINTENANCE',
  'NEIGHBOR',
  'CLEANING',
  'PET',
  'PARKING',
  'OTHER',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

/**
 * Os seis estados do atendimento. As transicoes validas sao do servidor
 * (`incident.service.ts::STATUS_FLOW`) e nao sao duplicadas aqui: a recusa dele
 * e um desfecho normal da tela (ADR-003).
 */
export const INCIDENT_STATUSES = [
  'OPEN',
  'IN_ANALYSIS',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type Incident = {
  id: string;
  condominiumId: string;
  unitId: string | null;
  /**
   * Sequencial legivel por ano, no formato `OC-2026-000123`. Quem o gera e o
   * servidor: `createIncidentSchema` nao o aceita, entao o formulario o mostra
   * mas nunca o envia.
   */
  protocol: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  reportedById: string | null;
  /** Nulo quando a ocorrencia foi aberta como anonima. */
  reportedByName: string | null;
  isAnonymous: boolean;
  assignedToId: string | null;
  occurredAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  attachments: string[] | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Uma linha de `GET /incidents/summary`.
 *
 * O corpo e um array, e nao um objeto com contadores nomeados:
 * `incidentService.statusSummary` mapeia o agrupamento do repositorio para
 * `{ status, total }` — e so os status presentes aparecem, entao um status sem
 * ocorrencias nao vem como zero, vem ausente.
 */
export type IncidentSummaryEntry = {
  status: IncidentStatus;
  total: number;
};

/**
 * Usuario elegivel como responsavel por uma ocorrencia.
 *
 * `/users` e por tenant e nao aceita `condominiumId` como filtro — a relacao com
 * condominios vem embutida na resposta (`UserRepository.relations`). O recorte
 * por condominio acontece no cliente, e e por isso que este tipo existe: a tela
 * so precisa do que serve ao seletor.
 */
export type IncidentAssignee = {
  id: string;
  name: string;
  email: string;
  status: string;
  /**
   * Condominios visiveis para o usuario. Vazio ou ausente significa "todos do
   * tenant", que e como perfis administrativos sao cadastrados — e como o
   * proprio servidor os trata em `recipientsService.usersOfCondominium`.
   */
  condominiums?: Array<{ id: string; name: string }> | null;
};
