import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGet, apiPatch } from '@/lib/api';
import { createUser, renderWithProviders, screen, waitFor } from '@/test/render';
import { TenantPage } from './tenant-page';
import {
  lastTenantPatch,
  makeTenant,
  makeTenantWorld,
  serveTenant,
  type TenantWorld,
} from './test-utils';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
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

/** Mesmo custo de portal do Radix medido nas demais telas. */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const mockGet = vi.mocked(apiGet);
const mockPatch = vi.mocked(apiPatch);

/** A matriz semeada: o ADMIN edita, o SINDICO so le. */
const ADMIN = ['tenant:read', 'tenant:update'];
const SINDICO = ['tenant:read'];

/** Os cinco que `tenantService.update` recusa com 403 a quem nao e super-admin. */
const COMMERCIAL_FIELDS = ['plan', 'status', 'maxCondominiums', 'maxUsers', 'slug'] as const;

let world: TenantWorld;

beforeEach(() => {
  vi.clearAllMocks();
  world = makeTenantWorld();
  serveTenant(world);
});

function render(permissions: string[] = ADMIN) {
  return renderWithProviders(<TenantPage />, { permissions });
}

function saveButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Salvar' });
}

describe('Carregamento', () => {
  it('le /tenants/me e preenche o formulario com o que voltou', async () => {
    render();

    expect(await screen.findByLabelText('Nome')).toHaveValue('Administradora Aurora');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12345678000190');
    expect(screen.getByLabelText('Carencia')).toHaveValue(5);
    // Percentuais sao campos de texto: a virgula decimal nao sobrevive a um
    // `input type="number"`. Ver o comentario em `tenant-settings-form.tsx`.
    expect(screen.getByLabelText('Multa (%)')).toHaveValue('2');
    expect(screen.getByLabelText('Juros (% ao mes)')).toHaveValue('1');
  });

  it('administradora sem politica gravada mostra os padroes do servidor, e nao campos vazios', async () => {
    // `applyLateFees` cai em 0 dia, 2% e 1% quando `settings` nao traz os
    // campos. Em branco, a tela esconderia a regra que esta valendo.
    world.tenant = makeTenant({ settings: { timezone: 'America/Sao_Paulo' } });
    render();

    expect(await screen.findByLabelText('Carencia')).toHaveValue(0);
    expect(screen.getByLabelText('Multa (%)')).toHaveValue('2');
    expect(screen.getByLabelText('Juros (% ao mes)')).toHaveValue('1');
  });

  it('falha na leitura aparece na tela, com nova tentativa', async () => {
    // Um 4xx de proposito: o `retry` do QueryProvider nao repete erro de
    // cliente, entao o estado de erro aparece no primeiro ciclo.
    mockGet.mockRejectedValue(new ApiError('Servico indisponivel.', 422, 'UNPROCESSABLE_ENTITY'));
    render();

    expect(
      await screen.findByText(/Nao foi possivel carregar as configuracoes/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('nao dispara requisicao escopada a condominio', async () => {
    render();

    await screen.findByLabelText('Nome');
    const urls = mockGet.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(['/tenants/me']);
    // O recurso e a raiz do isolamento multi-tenant: nenhuma chamada carrega
    // o condominio do shell.
    const params = mockGet.mock.calls.map((call) => call[1]);
    expect(params.some((config) => JSON.stringify(config ?? {}).includes('condominium'))).toBe(
      false,
    );
  });
});

describe('Salvamento', () => {
  it('envia so os campos que a tela oferece', async () => {
    const user = createUser();
    render();

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Administradora Bosque');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/tenants/me', expect.anything()));
    expect(lastTenantPatch()).toEqual({
      name: 'Administradora Bosque',
      document: '12345678000190',
      email: 'contato@aurora.com.br',
      phone: '1133334444',
      logoUrl: null,
      settings: { chargeGraceDays: 5, latePenaltyPercent: 2, lateInterestPercent: 1 },
    });
    await waitFor(() => expect(vi.mocked(toast.success)).toHaveBeenCalled());
  });

  it('o corpo nao contem nenhum dos cinco campos comerciais', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Nome'), ' Ltda');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // Qualquer um deles faria `tenantService.update` responder 403 e o
    // salvamento inteiro falharia.
    const body = lastTenantPatch();
    for (const field of COMMERCIAL_FIELDS) {
      expect(body, field).not.toHaveProperty(field);
    }
  });

  it('settings vai como objeto e preserva as chaves que a tela nao oferece', async () => {
    const user = createUser();
    render();

    const grace = await screen.findByLabelText('Carencia');
    await user.clear(grace);
    await user.type(grace, '10');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // A tela manda so os tres; o servidor mescla — o duble faz o mesmo.
    expect(lastTenantPatch().settings).toEqual({
      chargeGraceDays: 10,
      latePenaltyPercent: 2,
      lateInterestPercent: 1,
    });
    expect(world.tenant.settings).toMatchObject({
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      primaryColor: '#2563eb',
      chargeGraceDays: 10,
    });
  });

  it('CNPJ vai so com digitos, e vazio vira nulo', async () => {
    const user = createUser();
    const document = await (async () => {
      render();
      return screen.findByLabelText('CNPJ');
    })();

    await user.clear(document);
    await user.type(document, '98.765.432/0001-10');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(lastTenantPatch()).toMatchObject({ document: '98765432000110' });
  });

  it('campo de texto apagado vai como nulo, e nao como chave ausente', async () => {
    const user = createUser();
    render();

    await user.clear(await screen.findByLabelText('E-mail'));
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // Chave ausente deixaria o valor antigo no banco.
    expect(lastTenantPatch()).toMatchObject({ email: null });
  });

  it('o botao so habilita depois de alguma mudanca', async () => {
    const user = createUser();
    render();

    expect(await saveButton()).toBeDisabled();

    await user.type(await screen.findByLabelText('Nome'), ' Ltda');
    expect(await saveButton()).toBeEnabled();
  });

  it('duplo clique em salvar dispara uma requisicao so', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Nome'), ' Ltda');
    const button = await saveButton();
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(mockPatch).toHaveBeenCalledTimes(1);
  });
});

describe('Validacao', () => {
  it('carencia fora de 0 a 30 e barrada antes de chegar ao servidor', async () => {
    const user = createUser();
    render();

    const grace = await screen.findByLabelText('Carencia');
    await user.clear(grace);
    await user.type(grace, '45');
    await user.click(await saveButton());

    expect(await screen.findByText('Use um numero inteiro de 0 a 30.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('multa fora de 0 a 20 e barrada', async () => {
    const user = createUser();
    render();

    const penalty = await screen.findByLabelText('Multa (%)');
    await user.clear(penalty);
    await user.type(penalty, '35');
    await user.click(await saveButton());

    expect(await screen.findByText('Use um percentual de 0 a 20.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('carencia fracionada e barrada, porque o servidor a quer inteira', async () => {
    const user = createUser();
    render();

    const grace = await screen.findByLabelText('Carencia');
    await user.clear(grace);
    await user.type(grace, '2.5');
    await user.click(await saveButton());

    expect(await screen.findByText('Use um numero inteiro de 0 a 30.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('percentual com virgula decimal chega como 1.5, e nao como 15', async () => {
    const user = createUser();
    render();

    const interest = await screen.findByLabelText('Juros (% ao mes)');
    await user.clear(interest);
    await user.type(interest, '1,5');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    // Este caso e a razao de o campo nao ser `type="number"`: la a virgula seria
    // descartada e "1,5" viraria "15" — juros de quinze por cento, sem aviso.
    expect(lastTenantPatch().settings).toMatchObject({ lateInterestPercent: 1.5 });
  });

  it('percentual com ponto decimal tambem e aceito', async () => {
    const user = createUser();
    render();

    const penalty = await screen.findByLabelText('Multa (%)');
    await user.clear(penalty);
    await user.type(penalty, '2.5');
    await user.click(await saveButton());

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(lastTenantPatch().settings).toMatchObject({ latePenaltyPercent: 2.5 });
  });

  it('percentual sem numero nenhum e barrado', async () => {
    const user = createUser();
    render();

    await user.clear(await screen.findByLabelText('Multa (%)'));
    await user.click(await saveButton());

    expect(await screen.findByText('Informe o percentual de multa.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('texto no lugar de percentual e barrado, e nao vira NaN', async () => {
    const user = createUser();
    render();

    const penalty = await screen.findByLabelText('Multa (%)');
    await user.clear(penalty);
    await user.type(penalty, 'abc');
    await user.click(await saveButton());

    expect(await screen.findByText('Use um percentual de 0 a 20.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('CNPJ com contagem errada e barrado', async () => {
    const user = createUser();
    render();

    const document = await screen.findByLabelText('CNPJ');
    await user.clear(document);
    await user.type(document, '123');
    await user.click(await saveButton());

    expect(await screen.findByText('CNPJ deve conter 14 digitos.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('logo sem URL completa e barrada', async () => {
    const user = createUser();
    render();

    await user.type(await screen.findByLabelText('Logo'), 'logo.png');
    await user.click(await saveButton());

    expect(
      await screen.findByText('Informe uma URL completa, comecando com http:// ou https://.'),
    ).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

describe('Recusas do servidor', () => {
  it('403 vira mensagem de formulario e preserva o preenchido', async () => {
    const user = createUser();
    mockPatch.mockRejectedValue(
      new ApiError(
        'Os campos plan so podem ser alterados pelo suporte da plataforma.',
        403,
        'FORBIDDEN',
      ),
    );
    render();

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Administradora Bosque');
    await user.click(await saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/suporte da plataforma/);
    // O que foi digitado continua na tela.
    expect(screen.getByLabelText('Nome')).toHaveValue('Administradora Bosque');
  });

  it('422 com campo pousa no campo que a provocou', async () => {
    const user = createUser();
    mockPatch.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'UNPROCESSABLE_ENTITY', [
        { field: 'document', message: 'CNPJ ja cadastrado.' },
      ]),
    );
    render();

    await user.type(await screen.findByLabelText('Nome'), ' Ltda');
    await user.click(await saveButton());

    expect(await screen.findByText('CNPJ ja cadastrado.')).toBeInTheDocument();
  });
});

describe('Plano e limites', () => {
  it('aparecem como leitura, sem campo editavel', async () => {
    render();

    expect(await screen.findByText('Profissional')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('aurora')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    // Nenhum dos cinco e um controle: a permissao de edicao nunca os destrava.
    expect(screen.queryByLabelText('Plano')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Situacao')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Identificador')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Limite de condominios')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Limite de usuarios')).not.toBeInTheDocument();
  });

  it('sem periodo de avaliacao, a linha nao aparece', async () => {
    render();

    await screen.findByText('Profissional');
    expect(screen.queryByText('Avaliacao ate')).not.toBeInTheDocument();
  });

  it('com periodo de avaliacao, a data aparece', async () => {
    world.tenant = makeTenant({ plan: 'TRIAL', trialEndsAt: '2026-12-31T12:00:00.000Z' });
    render();

    expect(await screen.findByText('Avaliacao ate')).toBeInTheDocument();
  });
});

describe('Permissao', () => {
  it('sem tenant:update a tela le e nao oferece salvar', async () => {
    render(SINDICO);

    // O sindico precisa conhecer a politica aplicada as cobrancas do predio.
    expect(await screen.findByLabelText('Carencia')).toHaveValue(5);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('sem tenant:update os campos ficam desabilitados', async () => {
    render(SINDICO);

    expect(await screen.findByLabelText('Nome')).toBeDisabled();
    expect(screen.getByLabelText('Multa (%)')).toBeDisabled();
  });
});
