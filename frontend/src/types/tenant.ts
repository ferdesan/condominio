/**
 * Espelha `backend/src/modules/tenants/tenant.entity.ts`.
 *
 * Arquivo proprio pela regra do cabecalho de `api.ts`: contrato novo nao entra
 * la. O que ja existe em `api.ts` e o resumo `tenant` aninhado no `AuthUser` —
 * cinco campos, o bastante para a topbar — e nao este cadastro completo.
 *
 * **A administradora e o proprio escopo.** `Tenant` nao estende
 * `TenantScopedEntity` no servidor: ela e a raiz do isolamento multi-tenant.
 * Por isso nada aqui carrega `condominiumId`, e a tela nao herda o seletor do
 * shell.
 *
 * **O schema do servidor aceita mais do que a tela oferece, de proposito.**
 * `updateTenantSchema` e `createTenantSchema.partial()`, mas
 * `tenantService.update` recusa com **403**, para quem nao e super-admin,
 * `plan`, `status`, `maxCondominiums`, `maxUsers` e `slug`. Sao campos
 * comerciais, alterados pelo suporte da plataforma. Ver `TenantPayload` em
 * `features/tenant/tenant-schema.ts`.
 */

export const TENANT_PLANS = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELED'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/**
 * Preferencias da administradora.
 *
 * **Tres dos seis sao lidos de verdade**, em
 * `backend/src/modules/financial/services/charge.service.ts` — `applyLateFees`
 * busca ali a carencia, a multa e os juros que aplica as cobrancas vencidas, e
 * cai num padrao embutido quando o campo esta ausente. Os outros tres
 * (`timezone`, `locale`, `primaryColor`) sao semeados e nao tem nenhum leitor:
 * a tela nao os oferece, pelo mesmo motivo que a de perfil nao oferece as flags
 * de notificacao.
 */
export type TenantSettings = {
  primaryColor?: string;
  timezone?: string;
  locale?: string;
  /** Dias de tolerancia antes da multa. Padrao do servidor: 0. */
  chargeGraceDays?: number;
  /** Percentual de multa sobre a cobranca vencida. Padrao do servidor: 2. */
  latePenaltyPercent?: number;
  /** Percentual de juros ao mes. Padrao do servidor: 1. */
  lateInterestPercent?: number;
};

export type Tenant = {
  id: string;
  name: string;
  /** Identificador na URL de login. So a plataforma o altera. */
  slug: string;
  /** CNPJ, guardado so com digitos. */
  document: string | null;
  email: string | null;
  phone: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  maxCondominiums: number;
  maxUsers: number;
  logoUrl: string | null;
  trialEndsAt: string | null;
  settings: TenantSettings | null;
  createdAt: string;
  updatedAt: string;
};
