/**
 * Fixtures e dubles da administradora.
 *
 * Modulo proprio pelo motivo de sempre: uma funcao exportada ao lado de um
 * componente levanta `react-refresh/only-export-components`. A fixture nao
 * mora em `test/fixtures.ts` porque aquele arquivo so conhece `types/api.ts`,
 * que esta fechado para contratos novos — `Tenant` vive em `types/tenant.ts`.
 */

import { vi } from 'vitest';
import { apiGet, apiPatch } from '@/lib/api';
import type { Tenant, TenantSettings } from '@/types/tenant';

const TIMESTAMPS = {
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
} as const;

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-1',
    name: 'Administradora Aurora',
    slug: 'aurora',
    document: '12345678000190',
    email: 'contato@aurora.com.br',
    phone: '1133334444',
    plan: 'PROFESSIONAL',
    status: 'ACTIVE',
    maxCondominiums: 10,
    maxUsers: 50,
    logoUrl: null,
    trialEndsAt: null,
    settings: {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      primaryColor: '#2563eb',
      chargeGraceDays: 5,
      latePenaltyPercent: 2,
      lateInterestPercent: 1,
    },
    ...TIMESTAMPS,
    ...overrides,
  };
}

export type TenantWorld = {
  tenant: Tenant;
};

export function makeTenantWorld(overrides: Partial<TenantWorld> = {}): TenantWorld {
  return { tenant: makeTenant(), ...overrides };
}

/**
 * Liga os dubles de transporte ao mundo (ADR-010).
 *
 * `PATCH /tenants/me` responde com o tenant ja remontado pelo servidor, e
 * **mescla** `settings` como `tenantService.update` faz. Um duble que apenas
 * ecoasse o corpo enviado esconderia a regra que a tela depende: mandar so os
 * tres campos de encargos nao pode apagar `timezone`, `locale` e
 * `primaryColor`.
 */
export function serveTenant(world: TenantWorld): void {
  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/tenants/me') return world.tenant as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  vi.mocked(apiPatch).mockImplementation(async (url, body) => {
    if (url !== '/tenants/me') throw new Error(`URL nao prevista no teste: ${url}`);
    const data = (body ?? {}) as Partial<Tenant> & { settings?: TenantSettings };
    world.tenant = {
      ...world.tenant,
      ...data,
      settings: data.settings
        ? { ...(world.tenant.settings ?? {}), ...data.settings }
        : world.tenant.settings,
    };
    return world.tenant as never;
  });
}

/** O corpo do ultimo `PATCH /tenants/me`. */
export function lastTenantPatch(): Record<string, unknown> {
  const calls = vi.mocked(apiPatch).mock.calls;
  return (calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>;
}
