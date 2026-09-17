/**
 * Contrato do modulo LGPD, espelhando `backend/src/modules/lgpd`: pedidos de
 * anonimizacao, consentimento e o payload canonico de exportacao (ADR-002).
 */

export type LgpdRequestStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';

export type LgpdConsentType = 'DATA_PROCESSING';

/** Linha da listagem de pedidos (`GET /lgpd/delete-requests`). */
export type LgpdRequestView = {
  id: string;
  residentId: string;
  residentName: string;
  condominiumId: string;
  status: LgpdRequestStatus;
  requestedAt: string;
  executedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
};

/** Resposta de `POST /lgpd/delete-request`. */
export type CreateDeleteRequestResult = {
  id: string;
  status: 'PENDING';
  requestedAt: string;
  requestedBy: string;
  residentId: string;
  residentName: string;
  condominiumId: string;
  notes: string | null;
  warnings: string[];
};

/** Resposta de `POST /lgpd/delete-request/:id/execute`. */
export type ExecuteDeleteResult = {
  id: string;
  status: 'EXECUTED';
  executedAt: string;
  residentsAnonymized: number;
  dependentsAnonymized: number;
  vehiclesAnonymized: number;
};

/** Consentimento do morador atual (`GET/POST /lgpd/consent`). */
export type LgpdConsent = {
  residentId: string;
  consentType: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  description: string | null;
  warnings: string[];
};

/** Estrutura canonica do payload de exportacao (ADR-002). */
export type LgpdExportPayload = {
  exportDate: string;
  platform: string;
  dataSubject: { name: string; email: string | null };
  resident: Record<string, unknown>;
  dependents: Array<Record<string, unknown>>;
  vehicles: Array<Record<string, unknown>>;
  reservations: Array<Record<string, unknown>>;
  financial: {
    charges: Array<Record<string, unknown>>;
    payments: Array<Record<string, unknown>>;
  };
  correspondences: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
};