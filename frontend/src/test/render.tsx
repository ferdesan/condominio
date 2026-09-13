/**
 * Monta um componente com os provedores reais: query client, roteador em
 * memoria e os contextos de autenticacao e de condominio (ADR-010).
 *
 * Papel e condominio selecionado entram por chamada, porque quase toda tela
 * renderiza de forma diferente conforme os dois. O isolamento de cache e
 * inerente: o `QueryProvider` constroi um client por montagem.
 */

import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  fireEvent,
  render,
  screen,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryProvider } from '@/providers/query-provider';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import {
  CondominiumContext,
  type CondominiumContextValue,
} from '@/providers/condominium-context';
import { hasPermission } from '@/lib/permissions';
import type { AuthUser, Condominium, SystemRole } from '@/types/api';
import { makeAuthUser, makeCondominium } from './fixtures';

/**
 * Espelha a matriz semeada em `backend/src/shared/constants/roles.ts` para os
 * recursos que estas telas tocam. `<recurso>:manage` ja implica as demais acoes.
 */
const BACK_OFFICE_RESOURCES = [
  'condominium',
  'block',
  'unit',
  'resident',
  'common-area',
  'reservation',
  'dashboard',
] as const;

const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['*'],
  SINDICO: BACK_OFFICE_RESOURCES.map((resource) => `${resource}:manage`),
  STAFF: [
    ...BACK_OFFICE_RESOURCES.map((resource) => `${resource}:read`),
    'reservation:update',
  ],
  RESIDENT: [
    ...BACK_OFFICE_RESOURCES.map((resource) => `${resource}:read`),
    'reservation:create',
    'reservation:update',
    'reservation:delete',
  ],
};

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Define as permissoes padrao; `permissions` sobrescreve quando informado. */
  role?: SystemRole;
  permissions?: string[];
  user?: Partial<AuthUser> | null;
  /** Condominio selecionado. `null` simula a ausencia de escolha. */
  condominium?: Condominium | null;
  condominiums?: Condominium[];
  isLoadingCondominiums?: boolean;
  /** Rota inicial do roteador em memoria. */
  route?: string;
  onSelectCondominium?: (id: string) => void;
};

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const {
    role = 'ADMIN',
    permissions,
    user,
    condominium,
    condominiums,
    isLoadingCondominiums = false,
    route = '/',
    onSelectCondominium = () => undefined,
    ...renderOptions
  } = options;

  const selected = condominium === undefined ? makeCondominium() : condominium;
  const collection = condominiums ?? (selected ? [selected] : []);
  const granted = permissions ?? ROLE_PERMISSIONS[role];

  const authValue: AuthContextValue =
    user === null
      ? {
          user: null,
          initializing: false,
          isAuthenticated: false,
          login: async () => undefined,
          logout: async () => undefined,
          can: () => false,
        }
      : {
          user: makeAuthUser({ role, permissions: granted, ...user }),
          initializing: false,
          isAuthenticated: true,
          login: async () => undefined,
          logout: async () => undefined,
          can: (permission?: string) => hasPermission(granted, permission),
        };

  const condominiumValue: CondominiumContextValue = {
    condominiums: collection,
    selected,
    selectedId: selected?.id ?? null,
    select: onSelectCondominium,
    isLoading: isLoadingCondominiums,
  };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryProvider>
        <AuthContext.Provider value={authValue}>
          <CondominiumContext.Provider value={condominiumValue}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </CondominiumContext.Provider>
        </AuthContext.Provider>
      </QueryProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * `userEvent` afinado para este ambiente. Use sempre este helper.
 *
 * `delay: null` evita que a fila de eventos fique presa em timers. Note que
 * nenhum dos dois ajustes resolve o custo de abrir um portal do Radix: medido
 * aqui, `user.click` num gatilho de select leva ~47s contra 64ms num botao
 * comum, com ou sem `pointerEventsCheck`. Para gatilhos de portal use
 * `clickTrigger` / `openSelect` / `selectOption`; este helper serve para
 * digitacao e botoes comuns.
 */
export function createUser(
  overrides: Parameters<typeof userEvent.setup>[0] = {},
): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0, ...overrides });
}

/**
 * Clica num gatilho do Radix (dialog, dropdown, popover).
 *
 * Use isto, e nao `user.click`, para qualquer controle que abra um portal:
 * medido neste repositorio, `userEvent.click` num gatilho de portal custa
 * dezenas de segundos e estoura o timeout, enquanto este caminho custa
 * milissegundos e produz o mesmo resultado. `user.click` continua otimo para
 * botoes comuns e `user.type` para campos de texto.
 */
export function clickTrigger(trigger: HTMLElement): void {
  fireEvent.click(trigger);
}

/** Abre um select do Radix. Mesmo motivo do `clickTrigger`. */
export function openSelect(trigger: HTMLElement): void {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

/** Abre o select e escolhe a opcao pelo nome acessivel. */
export function selectOption(trigger: HTMLElement, name: string | RegExp): void {
  openSelect(trigger);
  fireEvent.click(screen.getByRole('option', { name }));
}

export * from '@testing-library/react';
