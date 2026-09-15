/**
 * Rotulos e formatadores do perfil.
 *
 * Modulo proprio, e nao exportado do lado de um componente: uma funcao ou
 * constante exportada junto de um componente levanta
 * `react-refresh/only-export-components`.
 */

import type { SystemRole } from '@/types/api';
import type { ThemePreference } from './profile-schema';

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Seguir o sistema',
};

/**
 * Os cinco papeis semeados em `backend/src/shared/constants/roles.ts`.
 *
 * O servidor devolve `role` como o **nome** do papel, que num tenant com papeis
 * proprios pode ser qualquer texto — por isso `roleLabel` cai no valor recebido
 * em vez de mostrar vazio.
 */
const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN: 'Administrador',
  SINDICO: 'Sindico',
  STAFF: 'Equipe',
  RESIDENT: 'Morador',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as SystemRole] ?? role;
}

/**
 * Nome curto do navegador a partir do user agent.
 *
 * Nao e deteccao de navegador para decidir comportamento — e so um rotulo que
 * distingue as linhas da tabela. A ordem importa: Edge e Chrome se anunciam como
 * Safari, e Chrome se anuncia dentro do Edge, entao o mais especifico vem antes.
 */
export function browserLabel(userAgent: string | null): string {
  if (!userAgent) return 'Origem desconhecida';
  const known: Array<[RegExp, string]> = [
    [/edg\//i, 'Edge'],
    [/opr\/|opera/i, 'Opera'],
    [/firefox\//i, 'Firefox'],
    [/chrome\//i, 'Chrome'],
    [/safari\//i, 'Safari'],
  ];
  const match = known.find(([pattern]) => pattern.test(userAgent));
  return match ? match[1] : 'Outro navegador';
}

/**
 * O identificador logico da sessao, abreviado.
 *
 * Mostrado inteiro nao diz nada a mais e empurra as demais colunas para fora da
 * tela; abreviado ainda distingue duas sessoes do mesmo navegador, que e a unica
 * pergunta que ele responde aqui.
 */
export function shortSessionId(sessionId: string): string {
  return sessionId.length > 8 ? `${sessionId.slice(0, 8)}...` : sessionId;
}
