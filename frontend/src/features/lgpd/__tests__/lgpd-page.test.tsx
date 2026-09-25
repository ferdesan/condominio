import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError, apiGet, apiGetPaginated, apiPost } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import {
  clickTrigger,
  fireEvent,
  openCombobox,
  renderWithProviders,
  screen,
  waitFor,
} from '@/test/render';
import type { LgpdConsent, LgpdExportPayload, LgpdRequestView } from '@/types/lgpd';
import { LgpdPage } from '../lgpd-page';
import { REQUEST_STATUS_LABELS } from '../lgpd-labels';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiGet: vi.fn(),
    apiGetPaginated: vi.fn(),
    apiPost: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

// O download usa `URL.createObjectURL`/`revokeObjectURL` e um clique num link
// fabricado — nada disso existe de fato no jsdom.
beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

const mockGet = vi.mocked(apiGet);
const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockToastSuccess = vi.mocked(toast.success);

/** Estado do servidor durante um caso. */
type World = {
  requests: LgpdRequestView[];
  consent: LgpdConsent | null;
  residents: { id: string; name: string }[];
};

let world: World;

function makeExportPayload(): LgpdExportPayload {
  return {
    exportDate: '2026-09-17T10:00:00.000Z',
    platform: 'condominio-app',
    dataSubject: { name: 'Carlos Pereira', email: 'carlos@example.com' },
    resident: { id: 'resident-1', name: 'Carlos Pereira', document: null },
    dependents: [],
    vehicles: [],
    reservations: [],
    financial: { charges: [], payments: [] },
    correspondences: [],
    documents: [],
  };
}

function notFound(): ApiError {
  return new ApiError('not found', 404, 'NOT_FOUND');
}

function serve(requests: LgpdRequestView[], consent: LgpdConsent | null = null): void {
  world = { requests, consent, residents: [{ id: 'resident-1', name: 'Carlos Pereira' }] };

  mockGet.mockImplementation(async (url) => {
    if (url === '/lgpd/consent') {
      if (!world.consent) throw notFound();
      return world.consent;
    }
    if (url.startsWith('/lgpd/export')) return makeExportPayload();
    throw notFound();
  });

  mockGetPaginated.mockImplementation(async (url) => {
    if (url === '/lgpd/delete-requests') {
      return { data: world.requests, meta: makeMeta({ total: world.requests.length }) };
    }
    if (url === '/residents') {
      return {
        data: world.residents,
        meta: makeMeta({ total: world.residents.length, perPage: 200 }),
      };
    }
    return { data: [], meta: makeMeta({ total: 0 }) };
  });

  mockPost.mockImplementation(async (url, body) => {
    if (url === '/lgpd/delete-request') {
      return {
        id: 'request-2',
        status: 'PENDING',
        requestedAt: '2026-09-17T10:00:00.000Z',
        requestedBy: 'resident-1',
        residentId: 'resident-1',
        residentName: 'Carlos Pereira',
        condominiumId: 'cond-1',
        notes: null,
        warnings: ['Cobranças já emitidas serão preservadas.'],
      };
    }
    if (url.endsWith('/execute')) {
      return {
        id: 'request-1',
        status: 'EXECUTED',
        executedAt: '2026-09-17T10:30:00.000Z',
        residentsAnonymized: 1,
        dependentsAnonymized: 0,
        vehiclesAnonymized: 0,
      };
    }
    if (url.endsWith('/cancel')) {
      return makeRequest({ status: 'CANCELLED', cancelledAt: '2026-09-17T10:00:00.000Z' });
    }
    if (url === '/lgpd/consent' && world.consent) {
      const granted = (body as { granted?: boolean }).granted ?? false;
      world.consent = {
        ...world.consent,
        granted,
        grantedAt: granted ? '2026-09-17T11:00:00.000Z' : null,
        revokedAt: granted ? null : '2026-09-17T12:00:00.000Z',
      };
      return world.consent;
    }
    return {};
  });
}

function makeRequest(overrides: Partial<LgpdRequestView> = {}): LgpdRequestView {
  return {
    id: 'request-1',
    residentId: 'resident-1',
    residentName: 'Carlos Pereira',
    condominiumId: 'cond-1',
    status: 'PENDING',
    requestedAt: '2026-09-10T09:00:00.000Z',
    executedAt: null,
    cancelledAt: null,
    notes: null,
    ...overrides,
  };
}

function makeConsent(overrides: Partial<LgpdConsent> = {}): LgpdConsent {
  return {
    residentId: 'resident-1',
    consentType: 'DATA_PROCESSING',
    granted: false,
    grantedAt: null,
    revokedAt: null,
    description: null,
    warnings: [],
    ...overrides,
  };
}

/** Permissoes equivalentes ao papel de morador para o modulo LGPD. */
const RESIDENT_LGPD_PERMISSIONS = [
  'lgpd-request:create',
  'lgpd-consent:read',
  'lgpd-consent:create',
  'resident:read',
];

describe('Pagina LGPD (IT-056)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra as três abas e a fila de pedidos para quem le o modulo', async () => {
    serve([makeRequest()]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd' });

    expect(screen.getByRole('heading', { name: 'LGPD' })).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((el) => el.textContent)).toEqual(['Solicitações', 'Exportar', 'Consentimento']);

    // Aba padrao: a fila com os pedidos pendentes de decisao.
    await screen.findByText('Carlos Pereira');
    expect(screen.getByText(REQUEST_STATUS_LABELS.PENDING)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Executar solicitação de Carlos Pereira' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancelar solicitação de Carlos Pereira' }),
    ).toBeInTheDocument();
    expect(mockGetPaginated).toHaveBeenCalledWith('/lgpd/delete-requests', expect.anything());
  });

  it('navega entre as abas e mostra o conteudo correspondente', async () => {
    serve([makeRequest()]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Exportar' }));
    await screen.findByRole('button', { name: 'Exportar dados do morador' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Consentimento' }));
    await screen.findByText(/o consentimento de tratamento de dados e registrado por morador/i);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Solicitações' }));
    await screen.findByText('Carlos Pereira');
  });

  it('abre a aba exportação pela rota, como o atalho do perfil', async () => {
    serve([]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd?tab=export' });

    expect(screen.getByRole('button', { name: 'Exportar dados do morador' })).toBeInTheDocument();
  });

  it('IT-056.E1: administrador executa e cancela um pedido', async () => {
    serve([makeRequest()]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd' });

    const execBtn = await screen.findByRole('button', {
      name: 'Executar solicitação de Carlos Pereira',
    });
    clickTrigger(execBtn);
    expect(screen.getByText(/os dados pessoais de Carlos Pereira serão anonimizados/i));
    clickTrigger(screen.getByRole('button', { name: 'Executar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/lgpd/delete-request/request-1/execute'),
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Anonimização executada.'));

    const cancelBtn = await screen.findByRole('button', {
      name: 'Cancelar solicitação de Carlos Pereira',
    });
    clickTrigger(cancelBtn);
    clickTrigger(screen.getByRole('button', { name: 'Cancelar solicitação' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/lgpd/delete-request/request-1/cancel'),
    );
  });

  it('IT-056.E2: morador so ve a superficie de pedido, não a de decisao', async () => {
    serve([makeRequest()]);

    renderWithProviders(<LgpdPage />, {
      role: 'RESIDENT',
      permissions: RESIDENT_LGPD_PERMISSIONS,
      route: '/lgpd',
    });

    const solicitBtn = await screen.findByRole('button', {
      name: 'Solicitar exclusao de dados',
    });
    expect(solicitBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /executar solicitação/i })).not.toBeInTheDocument();

    // Confirma a criacao do pedido.
    clickTrigger(solicitBtn);
    expect(screen.getByText(/seus dados pessoais serão anonimizados/i));
    clickTrigger(screen.getByRole('button', { name: 'Enviar solicitação' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/lgpd/delete-request', {
        condominiumId: 'cond-1',
      }),
    );
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith('Solicitação de exclusao enviada.'),
    );
  });

  it('IT-056.E3: morador exporta os próprios dados', async () => {
    serve([]);

    renderWithProviders(<LgpdPage />, {
      role: 'RESIDENT',
      permissions: RESIDENT_LGPD_PERMISSIONS,
      route: '/lgpd?tab=export',
    });

    clickTrigger(screen.getByRole('button', { name: 'Exportar meus dados' }));

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/lgpd/export'));
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith('Exportação dos seus dados gerada.'),
    );
  });

  it('administrador exporta os dados do morador escolhido', async () => {
    serve([]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd?tab=export' });

    const trigger = screen.getByRole('combobox', { name: 'Selecionar morador' });
    openCombobox(trigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Carlos Pereira' }));
    clickTrigger(screen.getByRole('button', { name: 'Exportar dados do morador' }));

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/lgpd/export/resident-1'));
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith('Exportação dos dados do morador gerada.'),
    );
  });

  it('morador concede e revoga o consentimento com confirmação', async () => {
    serve([], makeConsent());

    renderWithProviders(<LgpdPage />, {
      role: 'RESIDENT',
      permissions: RESIDENT_LGPD_PERMISSIONS,
      route: '/lgpd?tab=consent',
    });

    const toggle = await screen.findByRole('switch', {
      name: 'Autorização de tratamento de dados',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Concede.
    clickTrigger(toggle);
    expect(screen.getByText('Autorizar tratamento de dados?')).toBeInTheDocument();
    clickTrigger(screen.getByRole('button', { name: 'Autorizar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/lgpd/consent', {
        consentType: 'DATA_PROCESSING',
        granted: true,
      }),
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Consentimento registrado.'));

    // A invalidacao re-busca o consentimento concedido.
    const grantedToggle = await screen.findByRole('switch', {
      name: 'Autorização de tratamento de dados',
    });
    await waitFor(() => expect(grantedToggle).toHaveAttribute('aria-checked', 'true'));

    // Revoga.
    clickTrigger(grantedToggle);
    expect(screen.getByText('Revogar consentimento?')).toBeInTheDocument();
    clickTrigger(screen.getByRole('button', { name: 'Revogar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/lgpd/consent', {
        consentType: 'DATA_PROCESSING',
        granted: false,
      }),
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Consentimento revogado.'));
  });

  it('demais papéis recebem a vista read-only do consentimento', async () => {
    serve([]);

    renderWithProviders(<LgpdPage />, { route: '/lgpd?tab=consent' });

    expect(
      screen.getByText(/o consentimento de tratamento de dados e registrado por morador/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith('/lgpd/consent', expect.anything());
  });
});
