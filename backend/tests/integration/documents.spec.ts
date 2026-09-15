import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { uploadRoot } from '@/middlewares/upload.middleware';
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

describe('Acervo de documentos', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  /** `uploads-test/<tenantId>`, com um uuid novo a cada execucao. */
  let tenantDir: string;

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
    tenantDir = path.join(uploadRoot, ctx.seed.tenantId);
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
});
