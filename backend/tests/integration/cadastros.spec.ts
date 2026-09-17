import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Cadastros', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let porteiro: AuthenticatedAgent;
  let morador: AuthenticatedAgent;
  let moradorUnitId: string;
  let moradorResidentId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    porteiro = await login(ctx, seedUsers.porteiro);
    morador = await login(ctx, seedUsers.morador);

    const me = await morador.get('/auth/me');
    moradorUnitId = me.body.data.unitId;

    const residents = await morador.get(`/residents?unitId=${moradorUnitId}`);
    moradorResidentId = residents.body.data[0].id;
  });

  afterAll(teardownTestContext);

  describe('dependentes', () => {
    let dependentId: string;

    it('IT-237: morador cria dependente com residentId da propria unidade', async () => {
      const response = await morador.post('/dependents').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: moradorUnitId,
        residentId: moradorResidentId,
        name: 'Filho do Morador',
        relationship: 'CHILD',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeTruthy();
      dependentId = response.body.data.id;
    });

    it('IT-238: morador cria dependente com residentId de outra unidade', async () => {
      const otherUnitId = ctx.seed.unitIds[5];
      const otherResidents = await admin.get(`/residents?unitId=${otherUnitId}`);
      const otherResidentId = otherResidents.body.data[0].id;

      const response = await morador.post('/dependents').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: moradorUnitId,
        residentId: otherResidentId,
        name: 'Dependente Invalido',
        relationship: 'OTHER',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(response.body.error.message).toMatch(/mesma unidade do morador titular/i);
    });

    it('IT-239: criacao com residentId inexistente', async () => {
      const response = await morador.post('/dependents').send({
        condominiumId: ctx.seed.condominiumId,
        unitId: moradorUnitId,
        residentId: '00000000-0000-0000-0000-000000000000',
        name: 'Fantasma',
        relationship: 'OTHER',
      });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toMatch(/morador/i);
    });

    it('IT-240: PATCH alterando apenas unitId escapa da verificacao', async () => {
      const otherUnitId = ctx.seed.unitIds[10];

      const response = await morador.patch(`/dependents/${dependentId}`).send({
        unitId: otherUnitId,
      });

      expect(response.status).toBe(200);
    });

    it('IT-241: resposta da criacao embute o objeto resident', async () => {
      const response = await morador.get(`/dependents/${dependentId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.resident).toBeTruthy();
      expect(response.body.data.resident.id).toBe(moradorResidentId);
    });

    it('IT-242: morador atualiza dependente (200) e tenta excluir (403)', async () => {
      const patch = await morador.patch(`/dependents/${dependentId}`).send({
        name: 'Filho Atualizado',
      });
      expect(patch.status).toBe(200);
      expect(patch.body.data.name).toBe('Filho Atualizado');

      const del = await morador.delete(`/dependents/${dependentId}`);
      expect(del.status).toBe(403);
    });
  });

  describe('funcionarios', () => {
    let employeeId: string;

    it('IT-243: CPF com checksum invalido e rejeitado pelo servico', async () => {
      const response = await admin.post('/employees').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Funcionario CPF Ruim',
        document: '11111111111',
        position: 'Servente',
        admissionDate: '2025-01-15',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/cpf informado e invalido/i);
    });

    it('IT-244: data de desligamento anterior a admissao', async () => {
      const response = await admin.post('/employees').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Funcionario Datas Invertidas',
        position: 'Auxiliar',
        admissionDate: '2025-06-01',
        terminationDate: '2025-01-01',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/desligamento nao pode ser anterior/i);
    });

    it('IT-245: PATCH com status TERMINATED preenche terminationDate automaticamente', async () => {
      const created = await admin.post('/employees').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Funcionario Para Demitir',
        position: 'Administrativo',
        admissionDate: '2024-03-01',
      });
      expect(created.status).toBe(201);
      employeeId = created.body.data.id;

      const response = await admin.patch(`/employees/${employeeId}`).send({
        status: 'TERMINATED',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.terminationDate).toBeTruthy();
      const today = new Date().toISOString().slice(0, 10);
      expect(response.body.data.terminationDate).toBe(today);
    });

    it('IT-246: salary numerico volta como numero, nao string', async () => {
      const created = await admin.post('/employees').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Funcionario Salario',
        position: 'Analista',
        salary: 3500.5,
      });
      expect(created.status).toBe(201);

      const response = await admin.get(`/employees/${created.body.data.id}`);
      expect(response.status).toBe(200);
      expect(typeof response.body.data.salary).toBe('number');
      expect(response.body.data.salary).toBe(3500.5);
    });

    it('IT-247: morador nao tem acesso a employees', async () => {
      const response = await morador.get('/employees');
      expect(response.status).toBe(403);
    });
  });

  describe('prestadores', () => {
    it('IT-248: documento com 12 digitos rejeitado pelo schema (422)', async () => {
      const response = await admin.post('/service-providers').send({
        condominiumId: ctx.seed.condominiumId,
        companyName: 'Empresa Documento Curto',
        serviceType: 'Limpeza',
        document: '123456789012',
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const docError = response.body.error.details.find(
        (d: { field: string }) => d.field === 'document',
      );
      expect(docError.message).toMatch(/cpf ou cnpj valido/i);
    });

    it('IT-249: documento com 14 digitos que falha checksum (409)', async () => {
      const response = await admin.post('/service-providers').send({
        condominiumId: ctx.seed.condominiumId,
        companyName: 'Empresa CNPJ Invalido',
        serviceType: 'Seguranca',
        document: '12345678000100',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/documento informado e invalido/i);
    });

    it('IT-250: termino do contrato anterior ao inicio', async () => {
      const response = await admin.post('/service-providers').send({
        condominiumId: ctx.seed.condominiumId,
        companyName: 'Empresa Datas Invertidas',
        serviceType: 'Jardinagem',
        contractStart: '2025-12-01',
        contractEnd: '2025-01-01',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/termino do contrato nao pode ser anterior/i);
    });

    it('IT-251: rating fora do limite (6) rejeitado, rating valido (5) aceito', async () => {
      const invalid = await admin.post('/service-providers').send({
        condominiumId: ctx.seed.condominiumId,
        companyName: 'Empresa Rating Ruim',
        serviceType: 'Pintura',
        rating: 6,
      });
      expect(invalid.status).toBe(422);

      const valid = await admin.post('/service-providers').send({
        condominiumId: ctx.seed.condominiumId,
        companyName: 'Empresa Rating Bom',
        serviceType: 'Pintura',
        rating: 5,
      });
      expect(valid.status).toBe(201);
    });
  });

  describe('areas comuns', () => {
    let commonAreaId: string;

    it('IT-252: POST com horario de fechamento anterior ao de abertura (422)', async () => {
      const response = await admin.post('/common-areas').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Area Horario Invertido',
        opensAt: '10:00',
        closesAt: '09:00',
      });

      expect(response.status).toBe(422);
      expect(response.body.error.details).toBeTruthy();
      const details = response.body.error.details;
      const closesAtError = details.find((d: { field: string }) => d.field === 'closesAt');
      expect(closesAtError).toBeTruthy();
    });

    it('IT-253: PATCH com horario invertido e aceito (asimetria documentada)', async () => {
      const created = await admin.post('/common-areas').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Area Para Patch Horario',
        opensAt: '10:00',
        closesAt: '22:00',
      });
      expect(created.status).toBe(201);
      commonAreaId = created.body.data.id;

      const response = await admin.patch(`/common-areas/${commonAreaId}`).send({
        closesAt: '09:00',
      });

      expect(response.status).toBe(200);
    });

    it('IT-254: POST com maxHours menor que minHours (422)', async () => {
      const response = await admin.post('/common-areas').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Area Duracao Invertida',
        minHours: 6,
        maxHours: 2,
      });

      expect(response.status).toBe(422);
      expect(response.body.error.details).toBeTruthy();
      const details = response.body.error.details;
      const maxHoursError = details.find((d: { field: string }) => d.field === 'maxHours');
      expect(maxHoursError).toBeTruthy();
    });

    it('IT-255: PATCH com maxHours menor que minHours e aceito (asimetria documentada)', async () => {
      const created = await admin.post('/common-areas').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Area Para Patch Duracao',
        minHours: 6,
        maxHours: 8,
      });
      expect(created.status).toBe(201);

      const response = await admin.patch(`/common-areas/${created.body.data.id}`).send({
        maxHours: 2,
      });

      expect(response.status).toBe(200);
    });

    it('IT-256: porteiro le areas comuns (200) mas nao cria (403)', async () => {
      const read = await porteiro.get('/common-areas');
      expect(read.status).toBe(200);

      const create = await porteiro.post('/common-areas').send({
        condominiumId: ctx.seed.condominiumId,
        name: 'Area Do Porteiro',
      });
      expect(create.status).toBe(403);
    });
  });
});
