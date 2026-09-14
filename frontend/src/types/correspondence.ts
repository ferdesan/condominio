/**
 * Espelha `backend/src/modules/correspondences/correspondence.entity.ts` e o
 * contrato de `correspondence.schema.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `visitor.ts`: `api.ts` e compartilhado
 * entre tasks e ja foi ponto de quebra.
 */

import type { Unit } from './api';

export const CORRESPONDENCE_TYPES = [
  'LETTER',
  'PACKAGE',
  'REGISTERED',
  'FOOD_DELIVERY',
  'OTHER',
] as const;
export type CorrespondenceType = (typeof CORRESPONDENCE_TYPES)[number];

export const CORRESPONDENCE_STATUSES = ['PENDING', 'DELIVERED', 'RETURNED'] as const;
export type CorrespondenceStatus = (typeof CORRESPONDENCE_STATUSES)[number];

export type Correspondence = {
  id: string;
  condominiumId: string;
  /** Obrigatorio no servidor: toda correspondencia chega para uma unidade. */
  unitId: string;
  /** Opcional: o destinatario nominal, quando a portaria o identifica. */
  residentId: string | null;
  type: CorrespondenceType;
  status: CorrespondenceStatus;
  carrier: string | null;
  trackingCode: string | null;
  description: string | null;
  /** Obrigatorio: o servidor preenche com o momento do cadastro quando omitido. */
  receivedAt: string;
  receivedBy: string | null;
  deliveredAt: string | null;
  deliveredTo: string | null;
  photoUrl: string | null;
  notes: string | null;
  /** Presente: a API faz eager load. Ausente quando a unidade foi removida. */
  unit?: Unit | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Corpo de `GET /correspondences/pending-count`.
 *
 * Como em visitantes, o corpo e um objeto: `correspondenceService.pendingCount`
 * devolve `{ pending }`.
 */
export type CorrespondencePendingCount = {
  pending: number;
};
