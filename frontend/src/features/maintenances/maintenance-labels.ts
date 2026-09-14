/**
 * Rotulos de manutencao, compartilhados pela listagem, os filtros, o formulario
 * e o destaque do que esta por vir.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type {
  MaintenanceRecurrence,
  MaintenanceStatus,
  MaintenanceType,
} from '@/types/maintenance';

export const TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventiva',
  CORRECTIVE: 'Corretiva',
  EMERGENCY: 'Emergencial',
  INSPECTION: 'Inspecao',
};

/**
 * Os rotulos do ciclo da ordem.
 *
 * Nenhum deles repete um cabecalho de coluna ("Titulo", "Ativo", "Tipo",
 * "Status", "Recorrencia", "Agendamento", "Prestador", "Responsavel") nem o
 * titulo do painel de destaque — a colisao que ja quebrou consultas por texto em
 * duas telas anteriores. Por isso a coluna se chama "Agendamento", e nao
 * "Agendada para", que teria "Agendada" como prefixo.
 */
export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em execucao',
  COMPLETED: 'Concluida',
  OVERDUE: 'Atrasada',
  CANCELED: 'Cancelada',
};

export const RECURRENCE_LABELS: Record<MaintenanceRecurrence, string> = {
  NONE: 'Sem repeticao',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

/** Dito quando a ordem nao foi entregue a nenhum prestador contratado. */
export const NO_PROVIDER = 'Equipe propria';

/** Dito quando ha prestador, mas o registro referido nao esta na lista carregada. */
export const PROVIDER_UNAVAILABLE = 'Prestador indisponivel';

/** Dito quando ninguem do condominio foi designado para acompanhar a ordem. */
export const NO_RESPONSIBLE = 'Sem responsavel';

/** Dito quando ha responsavel, mas o usuario referido nao esta na lista carregada. */
export const RESPONSIBLE_UNAVAILABLE = 'Responsavel indisponivel';

/** Dito quando a ordem nao nomeia o ativo ou o local a que se refere. */
export const NO_ASSET = 'Ativo nao informado';
