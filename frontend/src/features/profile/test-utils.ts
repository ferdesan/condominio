/**
 * Fixtures e dubles do perfil, compartilhados pelos casos da tela.
 *
 * Modulo proprio pelo motivo de sempre: uma funcao exportada ao lado de um
 * componente levanta `react-refresh/only-export-components`.
 */

import { vi } from 'vitest';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { makeAuthUser } from '@/test/fixtures';
import type { AuthUser } from '@/types/api';
import type { UserSession } from '@/types/profile';

export function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: 'session-1',
    sessionId: 'abcdef1234567890',
    createdAt: '2026-03-10T12:00:00.000Z',
    expiresAt: '2026-04-10T12:00:00.000Z',
    ipAddress: '200.10.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36',
    ...overrides,
  };
}

export type ProfileWorld = {
  user: AuthUser;
  sessions: UserSession[];
};

export function makeProfileWorld(overrides: Partial<ProfileWorld> = {}): ProfileWorld {
  return {
    user: makeAuthUser({ name: 'Marina Alves', phone: '11988887777' }),
    sessions: [makeSession()],
    ...overrides,
  };
}

/**
 * Liga os dubles de transporte ao mundo (ADR-010).
 *
 * `PATCH /auth/me` responde com o usuario ja mesclado, como o servidor faz —
 * `updateProfile` relê o registro e devolve o `AuthUser` inteiro, e nao o corpo
 * enviado. Uma resposta que apenas ecoasse o pedido esconderia justamente o bug
 * que a tela precisa evitar: mostrar o que foi digitado em vez do que ficou
 * gravado.
 */
export function serveProfile(world: ProfileWorld): void {
  vi.mocked(apiGet).mockImplementation(async (url) => {
    if (url === '/auth/sessions') return world.sessions as never;
    throw new Error(`URL nao prevista no teste: ${url}`);
  });

  vi.mocked(apiPatch).mockImplementation(async (url, body) => {
    if (url !== '/auth/me') throw new Error(`URL nao prevista no teste: ${url}`);
    const data = body as { name?: string; phone?: string | null };
    world.user = {
      ...world.user,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    };
    return world.user as never;
  });

  vi.mocked(apiPost).mockResolvedValue(undefined as never);
}

/** O corpo do ultimo `PATCH /auth/me`. */
export function lastProfilePatch(): Record<string, unknown> {
  const calls = vi.mocked(apiPatch).mock.calls;
  return (calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>;
}

/** O corpo do ultimo POST para a rota informada. */
export function lastPostTo(url: string): Record<string, unknown> | undefined {
  const calls = vi.mocked(apiPost).mock.calls.filter((call) => call[0] === url);
  return calls.length ? ((calls[calls.length - 1]?.[1] ?? {}) as Record<string, unknown>) : undefined;
}
