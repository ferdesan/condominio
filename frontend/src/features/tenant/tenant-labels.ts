/**
 * Rotulos da administradora.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { TenantPlan, TenantStatus } from '@/types/tenant';

export const PLAN_LABELS: Record<TenantPlan, string> = {
  TRIAL: 'Avaliacao',
  STARTER: 'Inicial',
  PROFESSIONAL: 'Profissional',
  ENTERPRISE: 'Corporativo',
};

/**
 * Os tres estados da conta da administradora.
 *
 * Nenhum repete um rotulo de campo do formulario ("Nome", "CNPJ", "E-mail",
 * "Telefone", "Logo") — a colisao de texto acessivel que ja quebrou consultas
 * em telas anteriores.
 */
export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
};

/** Dito no lugar de um campo que a administradora nunca preencheu. */
export const NOT_INFORMED = 'Nao informado';

/**
 * Quem altera os campos comerciais.
 *
 * Repetido em dois lugares da tela — no cartao de plano e na explicacao do
 * `slug` —, entao vive aqui para nao divergir entre eles.
 */
export const PLATFORM_ONLY = 'Alterado pelo suporte da plataforma.';
