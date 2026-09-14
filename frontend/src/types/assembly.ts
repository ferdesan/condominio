/**
 * Espelha `backend/src/modules/assemblies/entities/`.
 *
 * Arquivo proprio pela regra registrada no cabecalho de `types/api.ts`: recurso
 * novo ganha `types/<recurso>.ts`.
 *
 * **Sao dois recursos, e nao um.** Assembleias vivem em `/assemblies` e
 * votacoes em `/polls`, cada uma com o roteador CRUD compartilhado mais acoes
 * proprias. A votacao pode estar ligada a uma assembleia (`assemblyId`) ou
 * existir sozinha, como consulta aos moradores — o vinculo e opcional no
 * servidor, e a interface nao o torna obrigatorio.
 */

export const ASSEMBLY_TYPES = ['ORDINARY', 'EXTRAORDINARY'] as const;
export type AssemblyType = (typeof ASSEMBLY_TYPES)[number];

export const ASSEMBLY_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELED'] as const;
export type AssemblyStatus = (typeof ASSEMBLY_STATUSES)[number];

export const ASSEMBLY_MODES = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;
export type AssemblyMode = (typeof ASSEMBLY_MODES)[number];

export type Assembly = {
  id: string;
  condominiumId: string;
  title: string;
  description: string | null;
  type: AssemblyType;
  status: AssemblyStatus;
  mode: AssemblyMode;
  scheduledAt: string;
  /** Horario da segunda convocacao, quando nao ha quorum na primeira. */
  secondCallAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  /** Percentual minimo de unidades presentes para deliberar. */
  quorumPercent: number;
  agendaUrl: string | null;
  minutesUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attendeesCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const POLL_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'CANCELED'] as const;
export type PollStatus = (typeof POLL_STATUSES)[number];

export const POLL_VOTER_TYPES = ['OWNERS', 'ALL_RESIDENTS'] as const;
export type PollVoterType = (typeof POLL_VOTER_TYPES)[number];

/**
 * Alternativa de uma votacao.
 *
 * Os dois contadores sao desnormalizados e atualizados a cada voto; qual dos
 * dois vale depende de `weightedByFraction` na votacao.
 */
export type PollOption = {
  id: string;
  pollId: string;
  label: string;
  description: string | null;
  sortOrder: number;
  votesCount: number;
  votesWeight: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Poll = {
  id: string;
  condominiumId: string;
  /** Ausente numa consulta que nao pertence a nenhuma assembleia. */
  assemblyId: string | null;
  title: string;
  description: string | null;
  status: PollStatus;
  voterType: PollVoterType;
  /** Voto ponderado pela fracao ideal da unidade. */
  weightedByFraction: boolean;
  isSecret: boolean;
  allowMultiple: boolean;
  startsAt: string;
  endsAt: string;
  quorumPercent: number;
  totalVotes: number;
  eligibleUnits: number;
  resultsPublishedAt: string | null;
  /** Presente: `PollRepository` faz eager load das opcoes. */
  options?: PollOption[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Corpo de `GET /polls/:id/results`, e tambem o que `/close` e `/vote` devolvem.
 *
 * Nao e a votacao: e a apuracao dela, ja com o percentual calculado sobre o
 * denominador certo — peso quando ponderada, contagem quando nao.
 */
export type PollResults = {
  pollId: string;
  title: string;
  status: PollStatus;
  totalVotes: number;
  eligibleUnits: number;
  participationPercent: number;
  quorumPercent: number;
  quorumReached: boolean;
  weighted: boolean;
  options: Array<{
    id: string;
    label: string;
    votesCount: number;
    votesWeight: number;
    percent: number;
  }>;
};
