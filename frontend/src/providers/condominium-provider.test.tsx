/**
 * A selecao de condominio do shell: como ela se escolhe sozinha, como se
 * reconcilia com o que o usuario realmente pode ver, e o que acontece com as
 * telas dependentes quando a colecao muda debaixo dela.
 *
 * Aqui o provedor e o de verdade — e o objeto sob teste. Os testes de tela usam
 * o duble de contexto do harness, que nao exercita nada disto.
 */

import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { apiDelete, apiGetPaginated, apiPost, type Paginated } from '@/lib/api';
import { AuthContext, type AuthContextValue } from '@/providers/auth-context';
import { CondominiumProvider } from '@/providers/condominium-provider';
import { QueryProvider } from '@/providers/query-provider';
import { useCondominium } from '@/hooks/use-condominium';
import { condominiumHooks } from '@/features/condominiums/condominium-hooks';
import type { CondominiumPayload } from '@/features/condominiums/condominium-schema';
import { UnitsPage } from '@/features/units/units-page';
import { makeAuthUser, makeCondominium, makeMeta, makeUnit } from '@/test/fixtures';
import { listRequests } from '@/test/api-double';
import { clickTrigger, render, screen, waitFor } from '@/test/render';
import type { Condominium, Unit } from '@/types/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiGetPaginated: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

const STORAGE_KEY = 'condomínio.selectedCondominium';

const AURORA = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });
const BOSQUE = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });

const AUTH: AuthContextValue = {
  user: makeAuthUser({ role: 'ADMIN', permissions: ['*'] }),
  initializing: false,
  isAuthenticated: true,
  login: async () => undefined,
  logout: async () => undefined,
  updateUser: () => undefined,
  can: () => true,
};

/**
 * O mundo servido pelo duble, mutavel durante o caso: e assim que se simula a
 * colecao mudando entre duas leituras, que e do que toda reconciliacao depende.
 */
const world: { condominiums: Condominium[]; units: Unit[] } = { condominiums: [], units: [] };

function page<T>(data: T[], perPage: number): Paginated<T> {
  return { data, meta: makeMeta({ perPage, total: data.length }) };
}

function mount(children: ReactNode) {
  return render(
    <QueryProvider>
      <AuthContext.Provider value={AUTH}>
        <CondominiumProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </CondominiumProvider>
      </AuthContext.Provider>
    </QueryProvider>,
  );
}

/** Mostra o estado do contexto para que o teste leia pela tela, e nao por dentro. */
function SelectionProbe() {
  const { selected, condominiums } = useCondominium();
  return (
    <>
      <p data-testid="selected">{selected?.name ?? 'nenhum'}</p>
      <p data-testid="options">{condominiums.map((item) => item.name).join(', ')}</p>
    </>
  );
}

/** Cria e remove pela mesma fabrica que as telas usam (ADR-008). */
function MutationProbe() {
  const create = condominiumHooks.useCreate();
  const remove = condominiumHooks.useRemove();
  return (
    <>
      <button
        type="button"
        onClick={() => create.mutate({ name: 'Residencial Novo' } as CondominiumPayload)}
      >
        Criar condomínio
      </button>
      <button type="button" onClick={() => remove.mutate('cond-1')}>
        Remover o selecionado
      </button>
    </>
  );
}

function selection(): string {
  return screen.getByTestId('selected').textContent ?? '';
}

function options(): string {
  return screen.getByTestId('options').textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  world.condominiums = [AURORA, BOSQUE];
  world.units = [];

  vi.mocked(apiGetPaginated).mockImplementation(async (url, config) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === '/condominiums') return page(world.condominiums, 100) as never;
    if (url === '/units') {
      const scoped = world.units.filter((unit) => unit.condominiumId === params.condominiumId);
      return page(scoped, Number(params.perPage ?? 20)) as never;
    }
    if (url === '/blocks') return page([], 200) as never;
    throw new Error(`URL de listagem nao prevista no teste: ${url}`);
  });
});

describe('Seleção de condomínio', () => {
  it('IT-183: com exatamente um condomínio, ele já vem selecionado', async () => {
    world.condominiums = [AURORA];
    mount(<SelectionProbe />);

    // Nenhum passo manual: nao ha nada guardado e mesmo assim a escolha se faz.
    await waitFor(() => expect(selection()).toBe('Residencial Aurora'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cond-1');
  });

  it('IT-183: e a tela escopada já funciona, sem passo manual', async () => {
    world.condominiums = [AURORA];
    world.units = [makeUnit({ id: 'unit-1', number: '101', condominiumId: 'cond-1' })];
    mount(<UnitsPage />);

    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(listRequests('/units').at(-1)?.condominiumId).toBe('cond-1');
  });

  it('IT-184: uma seleção guardada fora da lista acessível cai para a primeira', async () => {
    // O condominio guardado saiu do alcance do usuario entre duas sessoes.
    localStorage.setItem(STORAGE_KEY, 'cond-de-outro-tenant');
    mount(<SelectionProbe />);

    await waitFor(() => expect(selection()).toBe('Residencial Aurora'));
    // A escolha corrigida tambem e persistida: o proximo boot nao repete a queda.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cond-1');
  });

  it('IT-184: uma seleção guardada ainda válida e respeitada', async () => {
    // A outra metade da regra: reconciliar nao pode significar reescolher sempre.
    localStorage.setItem(STORAGE_KEY, 'cond-2');
    mount(<SelectionProbe />);

    await waitFor(() => expect(selection()).toBe('Residencial Bosque'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cond-2');
  });

  it('IT-186: um condomínio criado fica selecionável sem recarregar a pagina', async () => {
    mount(
      <>
        <SelectionProbe />
        <MutationProbe />
      </>,
    );
    await waitFor(() => expect(selection()).toBe('Residencial Aurora'));
    expect(options()).toBe('Residencial Aurora, Residencial Bosque');

    const created = makeCondominium({ id: 'cond-3', name: 'Residencial Novo' });
    vi.mocked(apiPost).mockResolvedValue(created);
    world.condominiums = [AURORA, BOSQUE, created];

    clickTrigger(screen.getByRole('button', { name: 'Criar condomínio' }));

    // A fabrica invalida tambem a chave do seletor do shell, entao ele recarrega
    // sozinho — sem isso, o recem-criado so apareceria depois de um F5.
    await waitFor(() =>
      expect(options()).toBe('Residencial Aurora, Residencial Bosque, Residencial Novo'),
    );
    // A selecao corrente nao se mexe: criar nao e escolher.
    expect(selection()).toBe('Residencial Aurora');
  });

  it('IT-187: remover o condomínio selecionado move a seleção e as telas se recuperam', async () => {
    world.units = [makeUnit({ id: 'unit-1', number: '101', condominiumId: 'cond-1' })];

    mount(
      <>
        <SelectionProbe />
        <MutationProbe />
        <UnitsPage />
      </>,
    );
    await waitFor(() => expect(selection()).toBe('Residencial Aurora'));
    expect(await screen.findByText('101')).toBeInTheDocument();

    vi.mocked(apiDelete).mockResolvedValue(undefined);
    world.condominiums = [BOSQUE];
    clickTrigger(screen.getByRole('button', { name: 'Remover o selecionado' }));

    // A selecao anda sozinha para o que sobrou...
    await waitFor(() => expect(selection()).toBe('Residencial Bosque'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cond-2');

    // ...e a tela dependente volta a pedir, agora no condominio novo, em vez de
    // ficar presa a um escopo que nao existe mais.
    await waitFor(() => expect(listRequests('/units').at(-1)?.condominiumId).toBe('cond-2'));
    expect(await screen.findByText('Nenhuma unidade cadastrada')).toBeInTheDocument();
  });
});
