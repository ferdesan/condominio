/** Rotulos dos enums de morador, compartilhados pela listagem, os filtros e o formulario. */

import type { ResidentStatus, ResidentType } from '@/types/api';

export const TYPE_LABELS: Record<ResidentType, string> = {
  OWNER: 'Proprietario',
  TENANT: 'Locatario',
  OCCUPANT: 'Ocupante',
};

export const STATUS_LABELS: Record<ResidentStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  MOVED_OUT: 'Mudou-se',
};
