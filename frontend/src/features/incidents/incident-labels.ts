/**
 * Rotulos de ocorrencia, compartilhados pela listagem, os filtros, o formulario
 * e os indicadores.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao exportada
 * junto de um componente levanta `react-refresh/only-export-components`, o que ja
 * aconteceu em correspondencias.
 */

import type { IncidentCategory, IncidentPriority, IncidentStatus } from '@/types/incident';

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  NOISE: 'Barulho',
  SECURITY: 'Segurança',
  MAINTENANCE: 'Manutenção',
  NEIGHBOR: 'Vizinhança',
  CLEANING: 'Limpeza',
  PET: 'Animais',
  PARKING: 'Estacionamento',
  OTHER: 'Outros',
};

export const PRIORITY_LABELS: Record<IncidentPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

/**
 * Os rotulos do atendimento.
 *
 * Nenhum deles repete um cabecalho de coluna ("Protocolo", "Titulo",
 * "Categoria", "Prioridade", "Status", "Responsavel") nem o rotulo de um
 * indicador — a colisao que ja quebrou consultas por texto em duas telas
 * anteriores.
 */
export const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Aberta',
  IN_ANALYSIS: 'Em analise',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvida',
  CLOSED: 'Encerrada',
  REJECTED: 'Recusada',
};

/** Dito quando ninguem foi designado para atender a ocorrencia. */
export const NO_ASSIGNEE = 'Sem responsável';

/** Dito quando ha responsavel, mas o usuario referido nao esta na lista carregada. */
export const ASSIGNEE_UNAVAILABLE = 'Responsável indisponível';

/** Dito quando a ocorrencia foi aberta sem identificar quem a registrou. */
export const ANONYMOUS_REPORTER = 'Anonimo';
