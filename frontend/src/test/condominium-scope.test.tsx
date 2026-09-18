/**
 * O escopo de condominio conferido de fora das telas.
 *
 * Cada tela ja prova que limpa os proprios filtros ao trocar de condominio. O
 * que so se ve daqui e se *toda* requisicao das tres telas escopadas carrega a
 * selecao — uma consulta auxiliar esquecida devolve dados de outro predio sem
 * que nada na tela pareca errado — e o caso que atravessa a troca: um formulario
 * aberto no meio dela.
 */

import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '@/lib/api';
import { CondominiumContext } from '@/providers/condominium-context';
import { UnitsPage } from '@/features/units/units-page';
import { ResidentsPage } from '@/features/residents/residents-page';
import { ReservationsPage } from '@/features/reservations/reservations-page';
import {
  makeBlock,
  makeCommonArea,
  makeCondominium,
  makeResident,
  makeUnit,
} from '@/test/fixtures';
import { allRequests, serveAll, type Collections } from '@/test/api-double';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { Condominium } from '@/types/api';

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

const mockPost = vi.mocked(apiPost);

const AURORA = makeCondominium({ id: 'cond-1', name: 'Residencial Aurora' });
const BOSQUE = makeCondominium({ id: 'cond-2', name: 'Residencial Bosque' });

const WORLD: Collections = {
  blocks: [makeBlock({ id: 'block-1', name: 'Torre A' })],
  units: [makeUnit({ id: 'unit-1', number: '101' })],
  residents: [makeResident({ id: 'resident-1', name: 'Carlos Pereira' })],
  reservations: [],
  commonAreas: [makeCommonArea({ id: 'area-1', name: 'Salao de Festas' })],
};

/**
 * As rotas que nao pertencem a um condominio. `/condominiums` e a colecao raiz e
 * o unico recurso nao escopado; as demais precisam sempre carregar a selecao.
 */
const UNSCOPED = ['/condominiums'];

/** O shell de verdade em miniatura: um botao que troca o condominio selecionado. */
function SwitchableShell({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Condominium>(AURORA);
  return (
    <CondominiumContext.Provider
      value={{
        condominiums: [AURORA, BOSQUE],
        selected,
        selectedId: selected.id,
        select: () => setSelected(BOSQUE),
        isLoading: false,
      }}
    >
      {/*
        O Radix marca o resto da pagina como `aria-hidden` enquanto um dialogo
        esta aberto, e o seletor do shell fica justamente nessa parte — por isso
        a busca pelo botao usa `hidden`.
      */}
      <button type="button" onClick={() => setSelected(BOSQUE)}>
        Trocar condomínio
      </button>
      {children}
    </CondominiumContext.Provider>
  );
}

function switchCondominium(): void {
  clickTrigger(screen.getByRole('button', { name: 'Trocar condomínio', hidden: true }));
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

beforeEach(() => {
  vi.clearAllMocks();
  serveAll(WORLD);
});

describe('Escopo de condomínio', () => {
  it('IT-182: toda requisição das três telas escopadas carrega o condomínio selecionado', async () => {
    const scoped = makeCondominium({ id: 'cond-7', name: 'Residencial Sete' });

    const screens = [
      { name: 'Unidades', element: <UnitsPage />, marker: '101' },
      { name: 'Moradores', element: <ResidentsPage />, marker: 'Carlos Pereira' },
      { name: 'Reservas', element: <ReservationsPage />, marker: 'Salao de Festas' },
    ];

    for (const { name, element, marker } of screens) {
      vi.clearAllMocks();
      serveAll(WORLD);

      const view = renderWithProviders(element, { condominium: scoped });
      expect(
        (await screen.findAllByText(marker, undefined, { timeout: 5000 })).length,
        name,
      ).toBeGreaterThan(0);

      const requests = allRequests().filter((request) => !UNSCOPED.includes(request.url));
      expect(requests.length, `${name} não fez requisição nenhuma`).toBeGreaterThan(0);

      const unscoped = requests.filter((request) => request.params.condominiumId !== 'cond-7');
      expect(
        unscoped.map((request) => request.url),
        `${name} pediu sem o condomínio selecionado`,
      ).toEqual([]);

      view.unmount();
    }
  });

  it('IT-182: sem condomínio selecionado a tela explica, em vez de listar vazio', async () => {
    // Uma lista vazia e indistinguivel de um condominio sem registros; o pedido
    // tambem nao sai, porque nao ha escopo a que ele pertenca (US-027.AC-4).
    renderWithProviders(<UnitsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(allRequests()).toEqual([]);
  });

  it('IT-185: trocar de condomínio com o formulário de unidade aberto grava no de origem', async () => {
    const user = createUser();
    renderWithProviders(
      <SwitchableShell>
        <UnitsPage />
      </SwitchableShell>,
    );
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Nova unidade' }));
    await screen.findByRole('dialog');
    selectOption(dialog().getByLabelText('Bloco'), 'Torre A');
    await user.type(dialog().getByLabelText('Número'), '404');

    switchCondominium();

    // O formulario continua aberto, com o que foi digitado, e diz para onde grava.
    await screen.findByRole('alert');
    expect(dialog().getByLabelText('Número')).toHaveValue('404');
    expect(screen.getByRole('alert')).toHaveTextContent('Residencial Aurora');

    mockPost.mockResolvedValue(makeUnit({ id: 'unit-404', number: '404' }));
    clickTrigger(dialog().getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/units');
    expect(body).toMatchObject({ condominiumId: 'cond-1', number: '404' });
  });

  it('IT-185: trocar de condomínio com o formulário de morador aberto grava no de origem', async () => {
    const user = createUser();
    renderWithProviders(
      <SwitchableShell>
        <ResidentsPage />
      </SwitchableShell>,
    );
    await screen.findByText('Carlos Pereira');

    clickTrigger(screen.getByRole('button', { name: 'Novo morador' }));
    await screen.findByRole('dialog');
    selectOption(dialog().getByLabelText('Unidade'), 'Torre A - 101');
    await user.type(dialog().getByLabelText('Nome'), 'Beatriz Lima');

    switchCondominium();

    await screen.findByRole('alert');
    expect(dialog().getByLabelText('Nome')).toHaveValue('Beatriz Lima');

    mockPost.mockResolvedValue(makeResident({ id: 'resident-2', name: 'Beatriz Lima' }));
    clickTrigger(dialog().getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/residents');
    expect(body).toMatchObject({ condominiumId: 'cond-1', name: 'Beatriz Lima' });
  });

  it('IT-185: a gestao de blocos acompanha a troca, mas o formulário dentro dela não', async () => {
    // As duas metades da regra no mesmo caso: a listagem e do condominio do
    // shell (IT-205), o formulario aberto e do condominio em que comecou.
    const user = createUser();
    serveAll({
      ...WORLD,
      blocks: [makeBlock({ id: 'block-1', name: 'Torre A' })],
    });

    renderWithProviders(
      <SwitchableShell>
        <UnitsPage />
      </SwitchableShell>,
    );
    await screen.findByText('101');

    clickTrigger(screen.getByRole('button', { name: 'Gerenciar blocos' }));
    await screen.findByText('Blocos do condomínio');
    clickTrigger(dialog().getByRole('button', { name: 'Novo bloco' }));
    await screen.findByLabelText('Nome');
    await user.type(dialog().getByLabelText('Nome'), 'Ala Nova');

    switchCondominium();

    // A gestao atras recarregou para o novo condominio...
    await waitFor(() =>
      expect(
        allRequests().some(
          (request) => request.url === '/blocks' && request.params.condominiumId === 'cond-2',
        ),
      ).toBe(true),
    );

    // ...e o formulario aberto segue gravando no condominio de origem.
    mockPost.mockResolvedValue(makeBlock({ id: 'block-2', name: 'Ala Nova' }));
    clickTrigger(dialog().getByRole('button', { name: 'Criar bloco' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/blocks');
    expect(body).toMatchObject({ condominiumId: 'cond-1', name: 'Ala Nova' });
  });
});
