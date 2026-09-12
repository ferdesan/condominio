/** Espelha os contratos expostos por `/api/v1`. */

export const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SINDICO', 'STAFF', 'RESIDENT'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: SystemRole | string;
  permissions: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type Condominium = {
  id: string;
  name: string;
  document: string | null;
  type: string;
  status: string;
  city: string | null;
  state: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  totalUnits: number;
  syndicName: string | null;
  chargeDueDay: number;
  logoUrl: string | null;
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

export type ActivityEntry = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string;
  userName: string | null;
  createdAt: string;
};
