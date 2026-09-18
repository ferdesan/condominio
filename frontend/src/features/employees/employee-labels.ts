/** Rotulos dos enums de funcionario, compartilhados pela listagem, os filtros e o formulario. */

import type { EmployeeContractType, EmployeeStatus } from '@/types/api';

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Ativo',
  ON_LEAVE: 'Afastado',
  TERMINATED: 'Desligado',
};

export const CONTRACT_TYPE_LABELS: Record<EmployeeContractType, string> = {
  CLT: 'CLT',
  PJ: 'PJ',
  TEMPORARY: 'Temporário',
  OUTSOURCED: 'Terceirizado',
};
