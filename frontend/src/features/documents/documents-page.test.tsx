import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { api, ApiError, apiDelete, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import {
  clickTrigger,
  createUser,
  renderWithProviders,
  screen,
  selectOption,
  waitFor,
  within,
} from '@/test/render';
import type { DocumentFile } from '@/types/document';
import { DocumentsPage } from './documents-page';
import {
  lastListParams,
  makeDocument,
  serveDocuments,
  uploadedFields,
  type DocumentWorld,
} from './test-utils';

// O duble fica so na camada de transporte (ADR-010); `ApiError` continua real.
// `api` entra na lista porque o download nao passa pelos helpers: ele pede o
// arquivo cru, e o envelope JSON dos helpers nao se aplica a bytes.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: { get: vi.fn() },
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

const mockApiGet = vi.mocked(api.get);
const mockGetPaginated = vi.mocked(apiGetPaginated);
const mockPost = vi.mocked(apiPost);
const mockPatch = vi.mocked(apiPatch);
const mockDelete = vi.mocked(apiDelete);
const mockToastError = vi.mocked(toast.error);

let world: DocumentWorld;

const TITLE = 'Convenção do condomínio';

/** Permissoes de quem le o acervo e nao pode mexer nele. */
const READ_ONLY = ['document:read'];

/**
 * O jsdom nao implementa nem a URL de objeto nem o download de um link.
 *
 * Sem os dois primeiros stubs o codigo de download lanca; sem o terceiro, o
 * clique no link viraria uma tentativa de navegacao, que o jsdom reporta como
 * "Not implemented" e que nao tem nada a ver com o que se quer afirmar.
 */
const objectUrls: string[] = [];
let clickSpy: ReturnType<typeof vi.spyOn>;

function stubBrowserDownload(): void {
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:mock/${objectUrls.length}`;
    objectUrls.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

/** Linhas de dados, sem o cabecalho. */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

/** Indice da coluna pelo rotulo do cabecalho, para nao depender da ordem. */
function columnIndex(label: string): number {
  const headers = within(screen.getAllByRole('row')[0]).getAllByRole('columnheader');
  return headers.findIndex((header) => header.textContent?.trim().startsWith(label));
}

/** Conteudo de uma coluna em todas as linhas, na ordem em que aparecem. */
function cellsOf(label: string): string[] {
  const index = columnIndex(label);
  return dataRows().map((row) => within(row).getAllByRole('cell')[index].textContent?.trim() ?? '');
}

/**
 * Espera as linhas chegarem.
 *
 * A tabela existe desde o primeiro quadro, com uma linha de "Carregando..." no
 * lugar dos dados; quem prova que a resposta chegou e o titulo do documento.
 */
async function findRows(title: string = TITLE): Promise<HTMLElement> {
  return screen.findByText(title);
}

/** Um PDF pequeno e valido para o seletor de arquivo. */
function makeFile(name = 'ata.pdf', type = 'application/pdf'): File {
  return new File(['conteudo do arquivo'], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  objectUrls.length = 0;
  stubBrowserDownload();
});

afterEach(() => {
  clickSpy?.mockRestore();
});

describe('Listagem do acervo', () => {
  it('percorre busca e os dois filtros preservando o condomínio', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    const user = createUser();
    renderWithProviders(<DocumentsPage />);

    await findRows();
    expect(lastListParams().condominiumId).toBe('cond-1');

    await user.type(screen.getByLabelText('Buscar'), 'convencao');
    await waitFor(() => expect(lastListParams().search).toBe('convencao'));

    // `selectOption` usa `fireEvent`, que o RTL ja embrulha em `act`: o novo
    // pedido sai antes de a chamada retornar, entao a assercao e direta.
    selectOption(screen.getByLabelText('Categoria'), 'Convenção');
    expect(lastListParams().category).toBe('CONVENTION');

    selectOption(screen.getByLabelText('Quem ve'), 'Moradores');
    expect(lastListParams().visibility).toBe('RESIDENTS');

    // Os controles se somam, e o condominio do shell sobrevive a todos eles.
    expect(lastListParams()).toMatchObject({
      search: 'convencao',
      category: 'CONVENTION',
      visibility: 'RESIDENTS',
      condominiumId: 'cond-1',
    });
  });

  it('sem condomínio selecionado explica a exigência e não consulta nada', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    renderWithProviders(<DocumentsPage />, { condominium: null });

    expect(await screen.findByText('Selecione um condomínio')).toBeInTheDocument();
    expect(mockGetPaginated).not.toHaveBeenCalled();
  });

  it('documento vencido e marcado por texto, e não so por cor', async () => {
    world = serveDocuments({
      documents: [
        makeDocument({ expiresAt: '2020-01-31' }),
        makeDocument({ id: 'document-2', title: 'Apolice vigente', expiresAt: '2090-01-31' }),
      ],
    });
    renderWithProviders(<DocumentsPage />);

    await findRows();
    const [vencido, vigente] = cellsOf('Validade');
    expect(vencido).toContain('Vencido');
    expect(vigente).not.toContain('Vencido');
  });

  it('documento sem validade e sem marcadores diz isso, em vez de deixar a celula vazia', async () => {
    world = serveDocuments({
      documents: [makeDocument({ title: 'Laudo solto', expiresAt: null, tags: null })],
    });
    renderWithProviders(<DocumentsPage />);

    await findRows('Laudo solto');
    expect(cellsOf('Validade')[0]).toBe('Sem validade definida');
    expect(cellsOf('Marcadores')[0]).toBe('Sem marcadores');
  });

  it('lista vazia renderiza estado vazio, e não tabela em branco', async () => {
    world = serveDocuments({ documents: [] });
    renderWithProviders(<DocumentsPage />);

    expect(await screen.findByText('Nenhum documento no acervo')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Envio de documento', () => {
  it('envia o arquivo e os metadados como multipart', async () => {
    world = serveDocuments({ documents: [] });
    const user = createUser();
    mockPost.mockImplementation(async () => {
      world.documents = [makeDocument({ title: 'Ata de marco' })];
      return world.documents[0] as never;
    });
    renderWithProviders(<DocumentsPage />);

    await screen.findByText('Nenhum documento no acervo');
    clickTrigger(screen.getByRole('button', { name: 'Enviar documento' }));

    // O painel de filtros tambem tem "Categoria" e "Quem ve": as consultas do
    // dialogo sao escopadas nele, senao resolvem para o controle errado.
    const dialog = await screen.findByRole('dialog');
    await user.upload(within(dialog).getByLabelText('Arquivo'), makeFile());
    await user.type(within(dialog).getByLabelText('Título'), 'Ata de marco');
    await user.type(within(dialog).getByLabelText('Marcadores'), 'assembleia, 2026');
    selectOption(within(dialog).getByLabelText('Categoria'), 'Ata');

    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/documents');

    // O envio precisa anunciar multipart. Sem isso o axios serializa o `FormData`
    // para JSON — a instancia de `lib/api.ts` fixa `application/json` — e o
    // servidor responde `400 Envie o arquivo no campo "file".` A conversao em si
    // esta caracterizada em UT-101 e UT-102, em `lib/api.test.ts`.
    expect(config?.headers).toMatchObject({ 'Content-Type': 'multipart/form-data' });

    // O corpo precisa ser multipart de verdade: e o que o multer le, e um JSON
    // aqui passaria pelo type check e falharia so no servidor.
    const fields = uploadedFields(body);
    expect(fields.file).toBeInstanceOf(File);
    expect(fields.title).toBe('Ata de marco');
    expect(fields.category).toBe('MINUTES');
    expect(fields.condominiumId).toBe('cond-1');
    // Marcadores viajam como lista separada por virgulas, que e a forma que o
    // `uploadDocumentSchema` aceita no multipart — ja aparados, e nao como o
    // usuario digitou.
    expect(fields.tags).toBe('assembleia,2026');
    // Campo vazio nao entra: o `.optional()` do servidor nao trata '' como ausencia.
    expect(fields).not.toHaveProperty('description');
    expect(fields).not.toHaveProperty('expiresAt');
  });

  it('sem arquivo escolhido, a exigência aparece no campo e nada e enviado', async () => {
    world = serveDocuments({ documents: [] });
    const user = createUser();
    renderWithProviders(<DocumentsPage />);

    await screen.findByText('Nenhum documento no acervo');
    clickTrigger(screen.getByRole('button', { name: 'Enviar documento' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Título'), 'Ata sem arquivo');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Escolha o arquivo do documento.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('arquivo acima do limite e recusado antes de sair da maquina', async () => {
    world = serveDocuments({ documents: [] });
    const user = createUser();
    renderWithProviders(<DocumentsPage />);

    await screen.findByText('Nenhum documento no acervo');
    clickTrigger(screen.getByRole('button', { name: 'Enviar documento' }));

    const dialog = await screen.findByRole('dialog');
    const big = makeFile('enorme.pdf');
    // Definir o tamanho evita alocar onze megabytes so para exercitar o limite.
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });

    await user.upload(within(dialog).getByLabelText('Arquivo'), big);
    await user.type(within(dialog).getByLabelText('Título'), 'Arquivo grande');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('O arquivo excede o limite de 10 MB.')).toBeInTheDocument();
    // O ponto do limite no cliente e justamente nao subir o arquivo inteiro para
    // receber a recusa depois.
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('a recusa do servidor aparece no campo que ela aponta', async () => {
    world = serveDocuments({ documents: [] });
    const user = createUser();
    mockPost.mockRejectedValue(
      new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
        { field: 'title', message: 'Já existe um documento com este título.' },
      ]),
    );
    renderWithProviders(<DocumentsPage />);

    await screen.findByText('Nenhum documento no acervo');
    clickTrigger(screen.getByRole('button', { name: 'Enviar documento' }));

    const dialog = await screen.findByRole('dialog');
    await user.upload(within(dialog).getByLabelText('Arquivo'), makeFile());
    await user.type(within(dialog).getByLabelText('Título'), 'Repetido');
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Já existe um documento com este título.')).toBeInTheDocument();
    // O `onError` proprio substitui o toast global: a mesma recusa nao pode
    // aparecer duas vezes.
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe('Edição de metadados', () => {
  it('edita sem tocar no arquivo, e nem oferece troca-lo', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    const user = createUser();
    mockPatch.mockImplementation(
      async () => makeDocument({ title: 'Convenção revisada' }) as never,
    );
    renderWithProviders(<DocumentsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Editar ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    // Nao ha rota para substituir o arquivo, entao o campo nao existe aqui — em
    // vez de existir desabilitado, prometendo algo que o servidor nao faz.
    expect(within(dialog).queryByLabelText('Arquivo')).not.toBeInTheDocument();
    // Mas o nome do arquivo aparece, para nao editar o documento errado.
    expect(within(dialog).getByText('convenção.pdf')).toBeInTheDocument();

    const title = within(dialog).getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Convenção revisada');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    const [url, body] = mockPatch.mock.calls[0];
    expect(url).toBe('/documents/document-1');
    expect(body).toMatchObject({ title: 'Convenção revisada', category: 'CONVENTION' });
    expect(body).not.toHaveProperty('file');
  });

  it('descrição apagada vira nulo, e não texto vazio', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    const user = createUser();
    mockPatch.mockResolvedValue(makeDocument({ description: null }) as never);
    renderWithProviders(<DocumentsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Editar ${TITLE}` }));

    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Descrição'));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    // Apagar um campo opcional precisa chegar como nulo: string vazia deixaria o
    // valor antigo no lugar em qualquer schema que ignore vazios.
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ description: null });
  });
});

describe('Download', () => {
  it('pede o arquivo cru e o entrega ao navegador', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    renderWithProviders(<DocumentsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Baixar ${TITLE}` }));

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
    // `responseType: 'blob'` e o que separa esta chamada das demais: a rota
    // devolve bytes, e nao o envelope JSON que os helpers desembrulham.
    expect(mockApiGet).toHaveBeenCalledWith('/documents/document-1/download', {
      responseType: 'blob',
    });

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    // A URL de objeto e liberada: sem isso o blob fica na memoria da aba.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrls[0]);
  });

  it('a lista e reconsultada depois da baixa, porque o contador subiu', async () => {
    world = serveDocuments({ documents: [makeDocument({ downloadsCount: 12 })] });
    renderWithProviders(<DocumentsPage />);

    await findRows();
    expect(cellsOf('Downloads')[0]).toBe('12');

    world.documents = [makeDocument({ downloadsCount: 13 })];
    clickTrigger(screen.getByRole('button', { name: `Baixar ${TITLE}` }));

    await waitFor(() => expect(cellsOf('Downloads')[0]).toBe('13'));
  });

  it('dois cliques em sequência baixam uma vez so', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    renderWithProviders(<DocumentsPage />);

    await findRows();
    const button = screen.getByRole('button', { name: `Baixar ${TITLE}` });
    clickTrigger(button);
    clickTrigger(button);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
  });

  it('a recusa por visibilidade aparece na linha, com a razao legível', async () => {
    world = serveDocuments({ documents: [makeDocument({ visibility: 'ADMIN' })] });
    mockApiGet.mockRejectedValue(new ApiError('Request failed', 403, 'FORBIDDEN'));
    renderWithProviders(<DocumentsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Baixar ${TITLE}` }));

    // O corpo de erro de uma resposta `blob` tambem e um blob, entao a mensagem
    // do servidor nao chega: o status e o que sobra, e ele basta aqui.
    const message = await screen.findByText(
      'Este documento não esta disponível para o seu perfil.',
    );
    expect(message).toHaveAttribute('role', 'alert');
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe('Exclusao definitiva', () => {
  it('avisa que não ha volta antes de excluir', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    mockDelete.mockImplementation(async () => {
      world.documents = [];
    });
    renderWithProviders(<DocumentsPage />);

    await findRows();
    clickTrigger(screen.getByRole('button', { name: `Excluir ${TITLE}` }));

    // Nas demais telas "excluir" e reversivel; aqui o arquivo sai do disco, e a
    // confirmacao precisa dizer isso antes de qualquer requisicao.
    expect(await screen.findByText(/definitiva e não pode ser desfeita/i)).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();

    clickTrigger(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/documents/document-1'));
    expect(await screen.findByText('Nenhum documento no acervo')).toBeInTheDocument();
  });

  it('não oferece restaurar nem incluir removidos em lugar nenhum', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    renderWithProviders(<DocumentsPage />);

    await findRows();

    // Nao existe rota de restauracao no servidor: oferecer o controle seria
    // prometer o que o backend nao faz.
    expect(screen.queryByRole('button', { name: /^Restaurar/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Incluir removidos')).not.toBeInTheDocument();
  });
});

describe('Permissões', () => {
  it('sem escrita, so a leitura e a baixa continuam disponíveis', async () => {
    world = serveDocuments({ documents: [makeDocument()] });
    renderWithProviders(<DocumentsPage />, { permissions: READ_ONLY });

    await findRows();

    expect(screen.queryByRole('button', { name: 'Enviar documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Editar ${TITLE}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Excluir ${TITLE}` })).not.toBeInTheDocument();
    // Baixar continua: e leitura, e quem decide o acesso ao arquivo e o servidor.
    expect(screen.getByRole('button', { name: `Baixar ${TITLE}` })).toBeInTheDocument();
  });

  it('paginação pede a próxima pagina com os parametros certos', async () => {
    const roster = (count: number, offset = 0): DocumentFile[] =>
      Array.from({ length: count }, (_, index) => {
        const position = offset + index + 1;
        return makeDocument({
          id: `document-${position}`,
          title: `Documento ${String(position).padStart(2, '0')}`,
        });
      });

    world = serveDocuments({ documents: roster(20), total: 300 });
    const user = createUser();
    renderWithProviders(<DocumentsPage />);

    await screen.findByText('Documento 01');
    expect(dataRows()).toHaveLength(20);

    world.documents = roster(20, 20);
    await user.click(screen.getByRole('button', { name: /próxima|próxima|next/i }));

    await waitFor(() => expect(lastListParams().page).toBe(2));
    expect(await screen.findByText('Documento 21')).toBeInTheDocument();
    expect(lastListParams().perPage).toBe(20);
  });
});
