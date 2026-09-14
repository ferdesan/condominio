/**
 * Espelha `backend/src/modules/visitors/visitor.entity.ts` e o contrato de
 * `visitor.schema.ts`.
 *
 * Mora em arquivo proprio, e nao em `api.ts`, porque as telas do tier 2 sao
 * escritas em tasks separadas e um arquivo compartilhado entre elas ja quebrou
 * duas execucoes anteriores.
 */

import type { Unit } from './api';

export const VISITOR_TYPES = ['VISITOR', 'DELIVERY', 'SERVICE', 'BROKER', 'OTHER'] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];

export const VISITOR_STATUSES = [
  'EXPECTED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'DENIED',
  'CANCELED',
] as const;
export type VisitorStatus = (typeof VISITOR_STATUSES)[number];

export type Visitor = {
  id: string;
  condominiumId: string;
  /** Obrigatorio no servidor: toda visita e destinada a uma unidade. */
  unitId: string;
  name: string;
  /** CPF sem pontuacao, como o servidor guarda. */
  document: string | null;
  phone: string | null;
  type: VisitorType;
  status: VisitorStatus;
  company: string | null;
  vehiclePlate: string | null;
  expectedAt: string | null;
  expectedUntil: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  /** Morador que pre-autorizou a entrada; so existe em visita criada como prevista. */
  authorizedById: string | null;
  authorizedByName: string | null;
  registeredById: string | null;
  badgeNumber: string | null;
  photoUrl: string | null;
  /** Gerado pelo servidor na pre-autorizacao, para consulta na portaria. */
  accessCode: string | null;
  notes: string | null;
  /**
   * Presente: a API faz eager load. Ausente quando a unidade referida foi
   * removida — a linha continua legivel sem ela.
   */
  unit?: Unit | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Corpo de `GET /visitors/inside-count`.
 *
 * O envelope e o padrao, mas o corpo e um objeto e nao um numero solto:
 * `visitorService.insideCount` devolve `{ inside }`.
 */
export type VisitorInsideCount = {
  inside: number;
};
