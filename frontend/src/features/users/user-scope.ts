import type { AuthUser } from '@/types/api';
import type { User } from '@/types/user';

/**
 * Alcance do ator sobre a lista de usuarios.
 *
 * Espelha `UserService.hasTenantReach` no servidor: quem tem alcaca a
 * administradora inteira administra tambem as contas globais; quem administra
 * apenas alguns condominios, nao. O filtro de leitura ja esconde de um sindico os
 * usuarios de condominios que ele nao administra — estas funcoes tratam do
 * outro lado da mesma divisao, o que ele pode fazer com quem aparece.
 */

/** `true` quando o ator enxerga a administradora inteira, e nao parte dela. */
export function hasTenantWideReach(actor: AuthUser | null): boolean {
  if (!actor) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  return !actor.condominiumIds?.length;
}

/**
 * Conta sem nenhum condominio vinculado: por definicao do modelo, atende a
 * administradora toda. Lista vazia e "todos", nunca "nenhum" — inverter a leitura
 * esconderia justamente as contas que o sindico precisa enxergar para suporte.
 */
export function isGlobalUser(user: User): boolean {
  return (user.condominiums ?? []).length === 0;
}

/** A linha e somente leitura para o ator atual. */
export function isReadOnlyFor(actor: AuthUser | null, user: User): boolean {
  return !hasTenantWideReach(actor) && isGlobalUser(user);
}

export const GLOBAL_ACCOUNT_NOTICE =
  'Conta da administradora: altere o vínculo em outro perfil de acesso.';
