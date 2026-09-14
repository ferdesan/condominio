import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPatch } from '@/lib/api';
import { makeCondominium } from '@/test/fixtures';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/render';
import type { Condominium, CondominiumStats } from '@/types/api';
import { CondominiumDetailPage } from './condominium-detail-page';

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

const mockGet = vi.mocked(apiGet);
const mockPatch = vi.mocked(apiPatch);

const STATS: CondominiumStats = {
  units: 48,
  occupiedUnits: 41,
  residents: 96,
  vehicles: 63,
  openIncidents: 3,
  pendingCharges: 12,
  pendingReservations: 2,
};

const ZERO_STATS: CondominiumStats = {
  units: 0,
  occupiedUnits: 0,
  residents: 0,
  vehicles: 0,
  openIncidents: 0,
  pendingCharges: 0,
  pendingReservations: 0,
};

/**
 * As duas consultas da pagina passam pelo mesmo helper de transporte; o que as
 * separa e o sufixo da URL. Qualquer uma das duas pode receber um erro no lugar
 * do dado, que e justamente o que os casos independentes exercitam.
 */
function serveDetail(record: Condominium | Error, stats: CondominiumStats | Error): void {
  mockGet.mockImplementation(async (url: string) => {
    const answer = url.endsWith('/stats') ? stats : record;
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
}

function renderDetail(id = 'cond-1', options = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/condominios/:id" element={<CondominiumDetailPage />} />
    </Routes>,
    { route: `/condominios/${id}`, ...options },
  );
}

function indicators(): HTMLElement {
  return screen.getByRole('region', { name: 'Indicadores' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Detalhe do condominio', () => {
  it('IT-025: identificador inexistente rende o estado de nao encontrado com volta para a lista', async () => {
    serveDetail(new ApiError('Condominio nao encontrado.', 404, 'NOT_FOUND'), STATS);
    renderDetail('cond-inexistente');

    expect(await screen.findByText('Condominio nao encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a listagem' })).toHaveAttribute(
      'href',
      '/condominios',
    );
  });

  it('IT-026: mostra o cadastro completo e os sete indicadores, e edita no lugar', async () => {
    serveDetail(makeCondominium(), STATS);
    const user = createUser();
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();

    const record = screen.getByRole('region', { name: 'Cadastro' });
    expect(within(record).getByText('12.345.678/0001-99')).toBeInTheDocument();
    expect(within(record).getByText('Marina Alves')).toBeInTheDocument();
    expect(within(record).getByText(/Avenida Paulista/)).toBeInTheDocument();
    expect(within(record).getByText('contato@aurora.com.br')).toBeInTheDocument();

    const panel = indicators();
    const expected: [string, string][] = [
      ['Unidades', '48'],
      ['Unidades ocupadas', '41'],
      ['Moradores', '96'],
      ['Veiculos', '63'],
      ['Ocorrencias abertas', '3'],
      ['Cobrancas pendentes', '12'],
      ['Reservas pendentes', '2'],
    ];
    for (const [label, value] of expected) {
      const card = within(panel).getByText(label).closest('div')?.parentElement as HTMLElement;
      expect(within(card).getByText(value)).toBeInTheDocument();
    }
    expect(mockGet).toHaveBeenCalledWith('/condominiums/cond-1/stats');

    // O mesmo dialogo da listagem edita aqui, e a pagina se atualiza sem sair.
    const updated = makeCondominium({ syndicName: 'Joana Ribeiro' });
    mockPatch.mockResolvedValue(updated);
    clickTrigger(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(await screen.findByLabelText('Nome do sindico'));
    await user.type(screen.getByLabelText('Nome do sindico'), 'Joana Ribeiro');
    serveDetail(updated, STATS);
    clickTrigger(within(screen.getByRole('dialog')).getByRole('button', { name: /Salvar$/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Joana Ribeiro')).toBeInTheDocument();
  });

  it('IT-027: condominio removido rende nao encontrado', async () => {
    serveDetail(new ApiError('Condominio nao encontrado.', 404, 'NOT_FOUND'), STATS);
    renderDetail('cond-removido');

    expect(await screen.findByText('Condominio nao encontrado')).toBeInTheDocument();
  });

  it('IT-028: identificador malformado rende nao encontrado, e nao uma falha sem explicacao', async () => {
    // O servidor valida o parametro antes de consultar: um id que nao e UUID
    // volta como 422, mas para quem chegou pelo link e a mesma ausencia.
    serveDetail(new ApiError('Identificador invalido.', 422, 'VALIDATION_ERROR'), STATS);
    renderDetail('nao-e-um-uuid');

    expect(await screen.findByText('Condominio nao encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a listagem' })).toBeInTheDocument();
  });

  it('IT-029: indicadores zerados mostram zeros, nao os espacos de carregamento', async () => {
    serveDetail(makeCondominium(), ZERO_STATS);
    renderDetail();
    await screen.findByRole('heading', { name: 'Residencial Aurora' });

    const panel = indicators();
    await waitFor(() => expect(within(panel).getAllByText('0')).toHaveLength(7));
    // O esqueleto sai de cena: zero e um valor, nao ausencia de valor.
    expect(panel.querySelectorAll('.skeleton')).toHaveLength(0);
  });

  it('IT-030: cadastro carrega mesmo com os indicadores falhando, e a falha oferece nova tentativa', async () => {
    serveDetail(makeCondominium(), new ApiError('Erro interno do servidor.', 500, 'INTERNAL'));
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
    expect(
      await screen.findByText('Nao foi possivel carregar os indicadores.', undefined, {
        timeout: 6000,
      }),
    ).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: 'Tentar novamente' });
    serveDetail(makeCondominium(), STATS);
    clickTrigger(retry);

    // `48` tambem aparece no cadastro, como total de unidades: o indicador so
    // conta se estiver no painel.
    await waitFor(() => expect(within(indicators()).getByText('48')).toBeInTheDocument());
    // O cadastro nunca saiu da tela.
    expect(screen.getByRole('region', { name: 'Cadastro' })).toBeInTheDocument();
  });

  it('IT-031: 403 na rota de detalhe rende o estado de acesso negado', async () => {
    serveDetail(new ApiError('Acesso negado para este recurso.', 403, 'FORBIDDEN'), STATS);
    renderDetail('cond-de-outro-sindico');

    expect(await screen.findByText('Acesso negado')).toBeInTheDocument();
    expect(screen.queryByText('Condominio nao encontrado')).not.toBeInTheDocument();
  });

  it('o operador consulta o detalhe sem a acao de editar', async () => {
    serveDetail(makeCondominium(), STATS);
    renderDetail('cond-1', { role: 'STAFF' });

    expect(await screen.findByRole('heading', { name: 'Residencial Aurora' })).toBeInTheDocument();
    expect(within(indicators()).getByText('48')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });
});
