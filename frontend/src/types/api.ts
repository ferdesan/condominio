/**
 * Espelha os contratos expostos por `/api/v1`.
 *
 * ## Onde mora o tipo de um recurso
 *
 * **Recurso novo ganha `types/<recurso>.ts`; este arquivo esta fechado para
 * novos.** Visitantes, correspondencias, comunicados, ocorrencias, manutencoes,
 * usuarios, auditoria e notificacoes ja seguem essa regra. O que continua aqui
 * sao os contratos anteriores a ela — sessao, condominio, bloco, unidade,
 * morador, dependente, funcionario, prestador, veiculo, area comum, reserva e
 * painel.
 *
 * A separacao comecou como medida contra conflito de merge entre tarefas
 * concorrentes, mas permaneceu por um motivo proprio: cada arquivo de recurso
 * carrega as notas de contrato que so valem para ele — que `/users` e por tenant
 * e nao aceita `condominiumId`, que a trilha de auditoria nao tem rota de
 * escrita — e essas notas se perdem num arquivo de quatrocentas linhas.
 *
 * **Nao ha reexportacao daqui para os arquivos de recurso**, e isso foi
 * decidido, nao esquecido: uma barrica criaria dois caminhos de import validos
 * para o mesmo simbolo sem nada que escolhesse entre eles, e o valor de um
 * "ponto de entrada unico" so existe quando ele e o unico. Torna-lo unico
 * significaria reescrever os imports das oito telas recem-entregues, sem ganho
 * funcional nenhum. Cada tipo tem exatamente um lugar e um caminho de import; a
 * migracao do que sobrou aqui e uma tarefa propria, e nao um efeito colateral do
 * registro das rotas.
 */

export const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SINDICO', 'STAFF', 'RESIDENT'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * Preferencias guardadas na conta, de `users.preferences`.
 *
 * **So `theme` tem efeito hoje.** O servidor semeia as quatro em
 * `user.service.ts` e as devolve em `/auth/me`, mas nada no backend le
 * `emailNotifications` ou `pushNotifications` — nao ha despachante de e-mail nem
 * de push — e o frontend nao tem i18n que consuma `locale`. Por isso a tela de
 * perfil oferece apenas o tema: um interruptor ligado a nada seria pior do que
 * um campo ausente.
 */
export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  locale?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: SystemRole | string;
  permissions: string[];
  /** Ausente em contas semeadas antes da coluna existir. */
  preferences?: UserPreferences | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export const CONDOMINIUM_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED'] as const;
export type CondominiumType = (typeof CONDOMINIUM_TYPES)[number];

export const CONDOMINIUM_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type CondominiumStatus = (typeof CONDOMINIUM_STATUSES)[number];

export type Condominium = {
  id: string;
  name: string;
  document: string | null;
  type: CondominiumType;
  status: CondominiumStatus;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  phone: string | null;
  email: string | null;
  totalUnits: number;
  syndicName: string | null;
  syndicPhone: string | null;
  /** Data (`YYYY-MM-DD`): o backend expoe a coluna `date` como string. */
  syndicTermEndsAt: string | null;
  chargeDueDay: number;
  logoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * `/condominiums/:id/stats`: os sete contadores consolidados que a tela de
 * detalhe exibe. Espelha `CondominiumStats` em
 * `backend/src/modules/condominiums/condominium.service.ts`.
 */
export type CondominiumStats = {
  units: number;
  occupiedUnits: number;
  residents: number;
  vehicles: number;
  openIncidents: number;
  pendingCharges: number;
  pendingReservations: number;
};

// --- Blocos e unidades -------------------------------------------------------

export const BLOCK_TYPES = ['BLOCK', 'TOWER', 'WING', 'STREET'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type Block = {
  id: string;
  condominiumId: string;
  name: string;
  type: BlockType;
  description: string | null;
  floors: number;
  unitsPerFloor: number;
  hasElevator: boolean;
  condominium?: Condominium; // presente: a API faz eager load.
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const UNIT_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'PARKING', 'STORAGE'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_STATUSES = ['OCCUPIED', 'VACANT', 'RENOVATION', 'BLOCKED'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type Unit = {
  id: string;
  condominiumId: string;
  blockId: string;
  number: string;
  floor: number;
  type: UnitType;
  status: UnitStatus;
  area: number | null;
  idealFraction: number | null;
  monthlyFee: number;
  bedrooms: number;
  parkingSpots: number;
  petsAllowed: boolean;
  notes: string | null;
  block?: Block; // presente: a API faz eager load.
  condominium?: Condominium; // presente: a API faz eager load.
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Moradores ---------------------------------------------------------------

export const RESIDENT_TYPES = ['OWNER', 'TENANT', 'OCCUPANT'] as const;
export type ResidentType = (typeof RESIDENT_TYPES)[number];

export const RESIDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'MOVED_OUT'] as const;
export type ResidentStatus = (typeof RESIDENT_STATUSES)[number];

export type Resident = {
  id: string;
  condominiumId: string;
  unitId: string;
  userId: string | null;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  type: ResidentType;
  status: ResidentStatus;
  isPrimary: boolean;
  moveInDate: string | null;
  moveOutDate: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  photoUrl: string | null;
  lgpdConsentAt: string | null;
  notes: string | null;
  unit?: Unit; // presente: a API faz eager load.
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Dependentes -------------------------------------------------------------

export const DEPENDENT_RELATIONSHIPS = [
  'SPOUSE',
  'CHILD',
  'PARENT',
  'SIBLING',
  'EMPLOYEE',
  'OTHER',
] as const;
export type DependentRelationship = (typeof DEPENDENT_RELATIONSHIPS)[number];

export type Dependent = {
  id: string;
  condominiumId: string;
  unitId: string;
  residentId: string;
  name: string;
  relationship: DependentRelationship;
  document: string | null;
  birthDate: string | null;
  phone: string | null;
  photoUrl: string | null;
  hasAccessCard: boolean;
  active: boolean;
  resident?: Resident; // presente: a API faz eager load.
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Funcionarios ------------------------------------------------------------

export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_CONTRACT_TYPES = ['CLT', 'PJ', 'TEMPORARY', 'OUTSOURCED'] as const;
export type EmployeeContractType = (typeof EMPLOYEE_CONTRACT_TYPES)[number];

export type Employee = {
  id: string;
  condominiumId: string;
  /** Vinculo opcional com um usuario do sistema; nao ha tela para escolher um. */
  userId: string | null;
  name: string;
  document: string | null;
  position: string;
  department: string | null;
  contractType: EmployeeContractType;
  status: EmployeeStatus;
  email: string | null;
  phone: string | null;
  /** Datas (`YYYY-MM-DD`): o backend expoe as colunas `date` como string. */
  admissionDate: string | null;
  terminationDate: string | null;
  workSchedule: string | null;
  salary: number | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Prestadores de servico --------------------------------------------------

export const PROVIDER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/**
 * Fornecedor contratado pelo condominio. Unico cadastro cujo `document` aceita
 * dois formatos: 11 digitos (CPF, prestador pessoa fisica) ou 14 (CNPJ).
 */
export type ServiceProvider = {
  id: string;
  condominiumId: string;
  companyName: string;
  tradeName: string | null;
  document: string | null;
  serviceType: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: ProviderStatus;
  /** Datas (`YYYY-MM-DD`): o backend expoe as colunas `date` como string. */
  contractStart: string | null;
  contractEnd: string | null;
  /** Avaliacao de 1 a 5. Sem relacao aninhada: a listagem so tem campos proprios. */
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Veiculos ----------------------------------------------------------------

export const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'TRUCK', 'BICYCLE', 'OTHER'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type Vehicle = {
  id: string;
  condominiumId: string;
  /** Opcionais: um veiculo pode circular sem dono cadastrado no condominio. */
  unitId: string | null;
  residentId: string | null;
  /** Guardada sem pontuacao e em caixa alta: `ABC1234` ou `ABC1D23`. */
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: VehicleType;
  year: number | null;
  parkingSpot: string | null;
  stickerNumber: string | null;
  status: VehicleStatus;
  notes: string | null;
  /**
   * Presente: a API faz eager load. Ausente quando nao ha vinculo ou quando a
   * unidade foi removida — a coluna do banco e `ON DELETE SET NULL`.
   */
  unit?: Unit | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// --- Areas comuns e reservas -------------------------------------------------

export const COMMON_AREA_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'BLOCKED'] as const;
export type CommonAreaStatus = (typeof COMMON_AREA_STATUSES)[number];

export type CommonArea = {
  id: string;
  condominiumId: string;
  name: string;
  description: string | null;
  capacity: number;
  status: CommonAreaStatus;
  requiresApproval: boolean;
  reservationFee: number;
  /** Janela diaria de funcionamento no formato `HH:mm`. */
  opensAt: string;
  closesAt: string;
  /** Dias liberados (0 = domingo). `null` libera a semana inteira. */
  availableWeekdays: number[] | null;
  minHours: number;
  maxHours: number;
  advanceBookingDays: number;
  minIntervalDays: number;
  photoUrl: string | null;
  rules: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELED',
  'COMPLETED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export type Reservation = {
  id: string;
  condominiumId: string;
  commonAreaId: string;
  unitId: string;
  requestedById: string;
  requestedByName: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  guestsCount: number;
  fee: number;
  paidAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  statusReason: string | null;
  notes: string | null;
  commonArea?: CommonArea; // presente: a API faz eager load.
  unit?: Unit; // presente: a API faz eager load.
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * `/reservations/availability` devolve uma projecao achatada, e nao a entidade:
 * os nomes da area e da unidade ja vem resolvidos para o calendario.
 */
export type AvailabilityEntry = {
  id: string;
  commonAreaId: string;
  commonAreaName: string | null;
  unitId: string;
  unitNumber: string | null;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  requestedByName: string | null;
};

// --- Dashboard --------------------------------------------------------------

export type DashboardOverview = {
  condominium: { id: string; name: string };
  referenceMonth: string;
  units: { total: number; occupied: number; vacant: number; occupancyRate: number };
  people: { residents: number; employees: number; visitorsInside: number };
  finance: {
    billed: number;
    received: number;
    open: number;
    overdue: number;
    delinquencyRate: number;
    expenses: number;
    expensesPaid: number;
    balance: number;
  };
  operations: {
    openIncidents: number;
    pendingReservations: number;
    pendingCorrespondences: number;
    upcomingMaintenances: number;
    upcomingAssemblies: number;
  };
};

export type FinancialSeriesPoint = {
  referenceMonth: string;
  label: string;
  billed: number;
  received: number;
};

export type CategoryTotal = {
  categoryId: string;
  name: string;
  color: string | null;
  total: number;
};

/**
 * Contagem de ocorrencias por categoria, de `/dashboard/incidents-by-category`.
 *
 * **Nao e um `CategoryTotal`.** O irmao financeiro agrupa por uma entidade —
 * `financial_categories`, com id, nome e cor —, e este agrupa por um enum de
 * coluna: `dashboardService.incidentsByCategory` seleciona `incident.category`
 * cru. Nao ha id, nao ha cor, e o rotulo legivel e do cliente
 * (`features/incidents/incident-labels.ts`).
 *
 * `total` ja vem convertido para numero pelo servico; a consulta o devolve como
 * texto.
 */
export type IncidentCategoryTotal = {
  /** Um valor de `INCIDENT_CATEGORIES`, mas tipado solto: o que vier do banco chega aqui. */
  category: string;
  total: number;
};

export type ActivityEntry = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string;
  userName: string | null;
  createdAt: string;
};
