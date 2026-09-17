import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { uploadRoot } from '@/middlewares/upload.middleware';
import { DOCUMENT_VISIBILITIES, type DocumentVisibility } from '@/modules/documents/document.entity';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

type UploadOverrides = Partial<{
  title: string;
  visibility: string;
  filename: string;
  contentType: string;
  content: Buffer;
}>;

/**
 * As duas unicas personas semeadas que nao carregam `document:manage`, e
 * portanto as unicas em que a matriz de visibilidade chega a discriminar:
 * `admin`, `sindico` e `superAdmin` retornam antes de a regra ser consultada.
 */
type PersonaSemGestao = 'porteiro' | 'morador';

describe('Acervo de documentos', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let sindico: AuthenticatedAgent;
  let personas: Record<PersonaSemGestao, AuthenticatedAgent>;
  /** `uploads-test/<tenantId>`, com um uuid novo a cada execucao. */
  let tenantDir: string;
  /** Um documento por nivel de visibilidade, reusado pelas dez linhas da matriz. */
  const documentoPorVisibilidade = {} as Record<DocumentVisibility, string>;

  /**
   * Envio multipart completo, com um padrao valido em cada campo. O arquivo vai
   * como buffer em memoria: este repositorio nao tem diretorio de fixtures e
   * este trabalho nao cria um.
   */
  function upload(agent: AuthenticatedAgent, overrides: UploadOverrides = {}) {
    return agent
      .post('/documents')
      .field('condominiumId', ctx.seed.condominiumId)
      .field('title', overrides.title ?? 'Ata da assembleia de marco')
      .field('category', 'MINUTES')
      .field('visibility', overrides.visibility ?? 'RESIDENTS')
      .attach('file', overrides.content ?? Buffer.from('conteudo'), {
        filename: overrides.filename ?? 'ata.pdf',
        contentType: overrides.contentType ?? 'application/pdf',
      });
  }

  /** O que o tenant tem no disco agora. Diretorio ausente conta como vazio. */
  async function storedFiles(): Promise<string[]> {
    try {
      return (await fs.readdir(tenantDir)).sort();
    } catch {
      return [];
    }
  }

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    sindico = await login(ctx, seedUsers.sindico);
    personas = {
      porteiro: await login(ctx, seedUsers.porteiro),
      morador: await login(ctx, seedUsers.morador),
    };
    tenantDir = path.join(uploadRoot, ctx.seed.tenantId);

    // Um envio por visibilidade, reusado pelas duas personas: a matriz custa
    // cinco arquivos no disco, e nao um por caso (ADR-003).
    for (const visibilidade of DOCUMENT_VISIBILITIES) {
      const criado = await upload(admin, {
        title: `Documento de visibilidade ${visibilidade}`,
        visibility: visibilidade,
      });

      if (criado.status !== 201) {
        throw new Error(
          `Preparo da matriz falhou em ${visibilidade}: ${criado.status} ${JSON.stringify(criado.body)}`,
        );
      }

      documentoPorVisibilidade[visibilidade] = criado.body.data.id as string;
    }
  });

  afterAll(async () => {
    // Nada no repositorio limpa `uploads-test/`, e um arquivo que sobra aqui
    // aparece como nao rastreado na proxima vez que alguem olhar o git.
    await fs.rm(tenantDir, { recursive: true, force: true });
    await teardownTestContext();
  });

  describe('envio', () => {
    it('IT-214: corpo invalido recusa com 422 e nao deixa arquivo orfao no disco', async () => {
      const antes = await storedFiles();

      const response = await upload(admin, { title: 'A' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // O multer grava o arquivo antes de esta validacao rodar. Sem a limpeza
      // no handler, o disco teria um arquivo a mais que nenhum registro alcanca.
      expect(await storedFiles()).toEqual(antes);
    });

    it('IT-210: envio valido cria o documento com os metadados do formulario', async () => {
      const response = await upload(admin, { title: 'Ata da assembleia geral ordinaria' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Ata da assembleia geral ordinaria');
      expect(response.body.data.category).toBe('MINUTES');
      expect(response.body.data.visibility).toBe('RESIDENTS');
      expect(response.body.data.uploadedById).toBe(admin.userId);
      expect(response.body.data.version).toBe(1);
      expect(response.body.data.downloadsCount).toBe(0);
    });

    it('IT-211: envio com todos os campos de texto e sem a parte do arquivo recusa com 400', async () => {
      // Sem `.attach`: o helper sempre anexa, e o que este caso investiga e
      // justamente a ausencia da parte de arquivo num corpo multipart valido.
      const response = await admin
        .post('/documents')
        .field('condominiumId', ctx.seed.condominiumId)
        .field('title', 'Ata enviada sem anexo')
        .field('category', 'MINUTES')
        .field('visibility', 'RESIDENTS');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/envie o arquivo no campo/i);
    });

    it('IT-212: tipo de arquivo fora da lista permitida recusa com 400', async () => {
      const response = await upload(admin, {
        filename: 'ata.zip',
        contentType: 'application/zip',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/tipo de arquivo nao permitido/i);
    });

    it('IT-213: arquivo um byte acima do teto de 10 MB recusa com 400', async () => {
      const response = await upload(admin, {
        content: Buffer.alloc(10 * 1024 * 1024 + 1, 0x61),
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UPLOAD_LIMIT_FILE_SIZE');
    });

    it('IT-215: etiquetas enviadas como texto separado por virgula viram lista', async () => {
      const response = await upload(admin, { title: 'Ata com etiquetas' }).field(
        'tags',
        'assembleia, 2026',
      );

      expect(response.status).toBe(201);
      expect(response.body.data.tags).toEqual(['assembleia', '2026']);
    });

    it('IT-236: porteiro sem permissao de criacao recusa antes de o arquivo ser gravado', async () => {
      const antes = await storedFiles();

      const response = await upload(personas.porteiro);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      // `authorize` roda antes do multer, entao nao ha o que limpar: o disco
      // nem chega a ver o arquivo que a requisicao carregava.
      expect(await storedFiles()).toEqual(antes);
    });
  });

  describe('o arquivo guardado nao tem porta propria', () => {
    it('IT-234: o arquivo enviado nao e alcancavel por /uploads sem autenticacao', async () => {
      const enviado = await upload(admin);
      expect(enviado.status).toBe(201);

      // O nome em disco vem do proprio disco: a API deixou de devolver
      // `filePath`, e o teste precisa apontar para um arquivo que existe de
      // verdade — senao provaria apenas que uma URL inventada nao resolve.
      const arquivos = await storedFiles();
      expect(arquivos.length).toBeGreaterThan(0);

      const response = await request(ctx.app).get(
        `/uploads/${ctx.seed.tenantId}/${arquivos[arquivos.length - 1]}`,
      );

      expect(response.status).toBe(404);
    });

    it('IT-235: nenhuma resposta de documento carrega o caminho de armazenamento', async () => {
      const criado = await upload(admin, { title: 'Regimento interno revisado' });
      expect(criado.status).toBe(201);

      const id = criado.body.data.id as string;
      const lista = await admin.get('/documents?perPage=50');
      const individual = await admin.get(`/documents/${id}`);

      expect(lista.status).toBe(200);
      expect(individual.status).toBe(200);

      expect(criado.body.data).not.toHaveProperty('filePath');
      expect(individual.body.data).not.toHaveProperty('filePath');
      for (const documento of lista.body.data) {
        expect(documento).not.toHaveProperty('filePath');
      }
    });
  });

  describe('matriz de visibilidade', () => {
    /** `[id, visibilidade, persona, status, o que a linha demonstra]`. */
    type LinhaDaMatriz = [string, DocumentVisibility, PersonaSemGestao, number, string];

    // A tabela inteira, e nao so as negativas: a metade que nao se testa e a
    // metade que *concede* acesso, e alargar e a direcao que vaza (ADR-003).
    const MATRIZ: LinhaDaMatriz[] = [
      ['IT-216', 'PUBLIC', 'porteiro', 200, 'nivel aberto a qualquer perfil'],
      ['IT-217', 'PUBLIC', 'morador', 200, 'nivel aberto a qualquer perfil'],
      ['IT-218', 'RESIDENTS', 'porteiro', 200, 'o nivel nao exclui quem trabalha no predio'],
      ['IT-219', 'RESIDENTS', 'morador', 200, 'o publico nominal do nivel'],
      ['IT-220', 'OWNERS', 'porteiro', 403, 'STAFF e o unico papel que o nivel recusa'],
      ['IT-221', 'OWNERS', 'morador', 200, 'a regra le o papel e nao o tipo: o morador e locatario'],
      ['IT-222', 'STAFF', 'porteiro', 200, 'o nivel admite somente STAFF'],
      ['IT-223', 'STAFF', 'morador', 403, 'o nivel admite somente STAFF'],
      ['IT-224', 'ADMIN', 'porteiro', 403, 'o nivel nao admite ninguem sem document:manage'],
      ['IT-225', 'ADMIN', 'morador', 403, 'o nivel nao admite ninguem sem document:manage'],
    ];

    // Uma visibilidade nova no servidor quebra a tabela aqui, em vez de passar
    // despercebida por nao ter linha nenhuma (ADR-003).
    for (const visibilidade of DOCUMENT_VISIBILITIES) {
      const linhas = MATRIZ.filter(([, nivel]) => nivel === visibilidade);
      if (linhas.length !== 2) {
        throw new Error(
          `A matriz precisa de uma linha por persona em ${visibilidade}; tem ${linhas.length}.`,
        );
      }
    }

    it.each(MATRIZ)(
      '%s: documento %s baixado por %s responde %i (%s)',
      async (_id, visibilidade, persona, status) => {
        const response = await personas[persona].get(
          `/documents/${documentoPorVisibilidade[visibilidade]}/download`,
        );

        expect(response.status).toBe(status);
        if (status === 403) {
          expect(response.body.error.message).toMatch(/nao esta disponivel para o seu perfil/i);
        }
      },
    );

    it('IT-226: sindico com document:manage baixa o documento restrito a administracao', async () => {
      const response = await sindico.get(
        `/documents/${documentoPorVisibilidade.ADMIN}/download`,
      );

      // O atalho de `document:manage` retorna antes de a matriz ser consultada:
      // o mesmo documento que recusou porteiro e morador desce inteiro aqui.
      expect(response.status).toBe(200);
    });
  });

  describe('mecanica do download', () => {
    it('IT-227: dois downloads levam o contador de zero a dois', async () => {
      const criado = await upload(admin, { title: 'Relatorio de prestacao de contas' });
      expect(criado.status).toBe(201);
      expect(criado.body.data.downloadsCount).toBe(0);

      const id = criado.body.data.id as string;
      await admin.get(`/documents/${id}/download`);
      await admin.get(`/documents/${id}/download`);

      const depois = await admin.get(`/documents/${id}`);

      expect(depois.status).toBe(200);
      expect(depois.body.data.downloadsCount).toBe(2);
    });

    it('IT-228: a resposta nomeia o arquivo original, e nao o uuid guardado', async () => {
      const criado = await upload(admin, {
        title: 'Ata que preserva o nome de origem',
        filename: 'ata-de-marco.pdf',
      });
      expect(criado.status).toBe(201);

      const response = await admin.get(`/documents/${criado.body.data.id}/download`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('ata-de-marco.pdf');
      // O nome em disco e um uuid; se ele vazasse para o cabecalho, o cliente
      // salvaria o arquivo com o layout de armazenamento no nome.
      expect(response.headers['content-disposition']).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i,
      );
    });

    it('IT-229: o corpo baixado e igual byte a byte ao que foi enviado', async () => {
      const conteudo = Buffer.from('conteudo exclusivo deste caso, reconhecivel byte a byte\n');
      const criado = await upload(admin, {
        title: 'Documento com bytes proprios',
        content: conteudo,
      });
      expect(criado.status).toBe(201);

      const response = await admin.get(`/documents/${criado.body.data.id}/download`);

      // Falha se `filePath` voltar indefinido depois do `select: false` e o
      // caminho resolvido apontar para outro arquivo (ADR-001).
      expect(response.status).toBe(200);
      expect(response.body).toEqual(conteudo);
    });

    it('IT-230: documento semeado cujo arquivo nunca foi gravado recusa o download', async () => {
      const semeados = await admin.get('/documents?category=CONVENTION');
      expect(semeados.status).toBe(200);
      expect(semeados.body.data.length).toBeGreaterThan(0);

      const response = await admin.get(`/documents/${semeados.body.data[0].id}/download`);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/arquivo indisponivel/i);
    });
  });

  describe('listagem', () => {
    it('IT-231: filtro previsto restringe a lista e filtro fora da lista branca e ignorado', async () => {
      const filtrada = await admin.get('/documents?category=MINUTES&perPage=50');

      expect(filtrada.status).toBe(200);
      expect(filtrada.body.data.length).toBeGreaterThan(0);
      for (const documento of filtrada.body.data) {
        expect(documento.category).toBe('MINUTES');
      }

      const completa = await admin.get('/documents?perPage=50');
      const ignorada = await admin.get('/documents?downloadsCount=0&perPage=50');

      // A mecanica do download ja rodou, entao existe documento com contador
      // acima de zero: se o filtro fosse honrado, a pagina encolheria.
      expect(ignorada.status).toBe(200);
      expect(
        completa.body.data.some((documento: { downloadsCount: number }) => documento.downloadsCount > 0),
      ).toBe(true);
      expect(ignorada.body.meta.total).toBe(completa.body.meta.total);
    });

    it('IT-232: a paginacao devolve o recorte pedido na primeira pagina', async () => {
      const response = await admin.get('/documents?perPage=2');

      expect(response.status).toBe(200);
      expect(response.body.meta).toMatchObject({ page: 1, perPage: 2, hasPrevious: false });
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('atualizacao', () => {
    it('IT-257: alteracao de metadados nao encosta nos bytes guardados', async () => {
      const conteudo = Buffer.from('bytes que a atualizacao de metadados nao pode tocar\n');
      const criado = await upload(admin, {
        title: 'Circular a ser renomeada',
        content: conteudo,
      });
      expect(criado.status).toBe(201);

      const id = criado.body.data.id as string;
      const alterado = await admin
        .patch(`/documents/${id}`)
        .send({ title: 'Circular renomeada pela administracao', visibility: 'PUBLIC' });

      expect(alterado.status).toBe(200);
      expect(alterado.body.data.title).toBe('Circular renomeada pela administracao');
      expect(alterado.body.data.visibility).toBe('PUBLIC');

      // Nenhuma rota troca o arquivo, e a coluna oculta nao pode ser zerada
      // pelo merge do update: o download depois da alteracao prova as duas.
      const baixado = await admin.get(`/documents/${id}/download`);

      expect(baixado.status).toBe(200);
      expect(baixado.body).toEqual(conteudo);
    });
  });

  describe('exclusao', () => {
    it('IT-233: exclusao elimina o registro e tambem o arquivo do disco', async () => {
      const antes = await storedFiles();
      const criado = await upload(admin, { title: 'Documento a ser eliminado' });
      expect(criado.status).toBe(201);

      const novos = (await storedFiles()).filter((arquivo) => !antes.includes(arquivo));
      expect(novos).toHaveLength(1);

      const removido = await admin.delete(`/documents/${criado.body.data.id}`);
      expect(removido.status).toBe(204);

      const consulta = await admin.get(`/documents/${criado.body.data.id}`);
      expect(consulta.status).toBe(404);

      // A metade da eliminacao (LGPD) que o 204 sozinho nao mostra.
      expect(await storedFiles()).not.toContain(novos[0]);
    });
  });
});
