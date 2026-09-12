import { dayjs } from '@/shared/utils/date.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Operacao do condominio', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let porteiro: AuthenticatedAgent;
  let morador: AuthenticatedAgent;
  let unitId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    porteiro = await login(ctx, seedUsers.porteiro);
    morador = await login(ctx, seedUsers.morador);

    const me = await morador.get('/auth/me');
    unitId = me.body.data.unitId;
  });

  afterAll(teardownTestContext);

  describe('ocorrencias', () => {
    let incidentId: string;

    it('abre ocorrencia com protocolo sequencial', async () => {
      const response = await morador.post('/incidents').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        title: 'Infiltracao no teto da garagem',
        description: 'Ha uma infiltracao constante proxima a vaga 12.',
        category: 'MAINTENANCE',
        priority: 'HIGH',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.protocol).toMatch(/^OC-\d{4}-\d{6}$/);
      expect(response.body.data.status).toBe('OPEN');
      expect(response.body.data.reportedByName).toBeTruthy();

      incidentId = response.body.data.id;
    });

    it('preserva o anonimato quando solicitado', async () => {
      const response = await morador.post('/incidents').send({
        condominiumId: ctx.seed.condominiumId,
        title: 'Vizinho com animal sem coleira',
        description: 'Relato anonimo sobre circulacao de animal sem coleira nas areas comuns.',
        category: 'PET',
        isAnonymous: true,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.reportedByName).toBeNull();
    });

    it('rejeita transicao de status invalida', async () => {
      const response = await admin
        .post(`/incidents/${incidentId}/status`)
        .send({ status: 'CLOSED' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/transicao de status invalida/i);
    });

    it('exige tratativa para resolver a ocorrencia', async () => {
      await admin.post(`/incidents/${incidentId}/status`).send({ status: 'IN_PROGRESS' });

      const response = await admin
        .post(`/incidents/${incidentId}/status`)
        .send({ status: 'RESOLVED' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/tratativa/i);
    });

    it('resolve a ocorrencia e notifica quem abriu', async () => {
      const response = await admin.post(`/incidents/${incidentId}/status`).send({
        status: 'RESOLVED',
        resolution: 'Impermeabilizacao refeita pela equipe de manutencao.',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('RESOLVED');
      expect(response.body.data.resolvedAt).toBeTruthy();

      const notifications = await morador.get('/notifications');
      const titles = notifications.body.data.map((item: { title: string }) => item.title);
      expect(titles.some((title: string) => title.includes('atualizada'))).toBe(true);
    });

    it('atribui responsavel e resume por status', async () => {
      const created = await morador.post('/incidents').send({
        condominiumId: ctx.seed.condominiumId,
        title: 'Portao social com folga',
        description: 'O portao social nao trava corretamente ao fechar.',
        category: 'SECURITY',
      });

      const assigned = await admin
        .post(`/incidents/${created.body.data.id}/assign`)
        .send({ assignedToId: ctx.seed.users.sindico.id });

      expect(assigned.status).toBe(200);
      expect(assigned.body.data.status).toBe('IN_ANALYSIS');

      const summary = await admin.get(
        `/incidents/summary?condominiumId=${ctx.seed.condominiumId}`,
      );
      expect(summary.status).toBe(200);
      expect(summary.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('portaria', () => {
    it('registra correspondencia e notifica a unidade', async () => {
      const response = await porteiro.post('/correspondences').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        type: 'PACKAGE',
        carrier: 'Transportadora XPTO',
        description: 'Caixa grande',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.receivedBy).toBe('Carlos Portaria');

      const notifications = await morador.get('/notifications');
      const titles = notifications.body.data.map((item: { title: string }) => item.title);
      expect(titles).toContain('Nova correspondencia na portaria');
    });

    it('da baixa na retirada e bloqueia baixa duplicada', async () => {
      const pending = await porteiro.get('/correspondences?status=PENDING&perPage=1');
      const id = pending.body.data[0].id;

      const delivered = await porteiro
        .post(`/correspondences/${id}/deliver`)
        .send({ deliveredTo: 'Ana Silva' });

      expect(delivered.status).toBe(200);
      expect(delivered.body.data.status).toBe('DELIVERED');
      expect(delivered.body.data.deliveredAt).toBeTruthy();

      const again = await porteiro
        .post(`/correspondences/${id}/deliver`)
        .send({ deliveredTo: 'Ana Silva' });

      expect(again.status).toBe(409);
    });

    it('pre-autoriza visitante gerando codigo de acesso', async () => {
      const response = await morador.post('/visitors').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        name: 'Marcos Entregador',
        type: 'DELIVERY',
        expectedAt: dayjs().add(3, 'hour').toISOString(),
      });

      expect(response.status).toBe(201);
      expect(response.body.data.accessCode).toMatch(/^[0-9A-Z]{6}$/);
      expect(response.body.data.authorizedByName).toBeTruthy();
    });

    it('faz check-in e check-out do visitante', async () => {
      const expected = await porteiro.get('/visitors?status=EXPECTED&perPage=1');
      const visitorId = expected.body.data[0].id;

      const checkIn = await porteiro
        .post(`/visitors/${visitorId}/check-in`)
        .send({ badgeNumber: 'V-100' });

      expect(checkIn.status).toBe(200);
      expect(checkIn.body.data.status).toBe('CHECKED_IN');
      expect(checkIn.body.data.checkedInAt).toBeTruthy();

      const duplicate = await porteiro.post(`/visitors/${visitorId}/check-in`).send({});
      expect(duplicate.status).toBe(409);

      const checkOut = await porteiro.post(`/visitors/${visitorId}/check-out`).send({});
      expect(checkOut.status).toBe(200);
      expect(checkOut.body.data.status).toBe('CHECKED_OUT');
    });

    it('valida a placa do veiculo', async () => {
      const invalid = await admin.post('/vehicles').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        plate: '123',
      });
      expect(invalid.status).toBe(422);

      const valid = await admin.post('/vehicles').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        plate: 'rst1d23',
        brand: 'Toyota',
        model: 'Corolla',
      });
      expect(valid.status).toBe(201);
      expect(valid.body.data.plate).toBe('RST1D23');

      const duplicated = await admin.post('/vehicles').send({
        condominiumId: ctx.seed.condominiumId,
        unitId,
        plate: 'RST1D23',
      });
      expect(duplicated.status).toBe(409);
    });
  });

  describe('comunicados e manutencoes', () => {
    it('publica comunicado e entrega no mural', async () => {
      const created = await admin.post('/announcements').send({
        condominiumId: ctx.seed.condominiumId,
        title: 'Interrupcao no fornecimento de agua',
        content: 'Havera interrupcao no fornecimento de agua na quinta-feira, das 9h as 12h.',
        category: 'URGENT',
        status: 'DRAFT',
      });

      expect(created.status).toBe(201);
      expect(created.body.data.status).toBe('DRAFT');

      const published = await admin.post(`/announcements/${created.body.data.id}/publish`).send({});
      expect(published.status).toBe(200);
      expect(published.body.data.publishedAt).toBeTruthy();

      const board = await morador.get(
        `/announcements/board?condominiumId=${ctx.seed.condominiumId}`,
      );
      const titles = board.body.data.map((item: { title: string }) => item.title);
      expect(titles).toContain('Interrupcao no fornecimento de agua');

      const republish = await admin.post(`/announcements/${created.body.data.id}/publish`).send({});
      expect(republish.status).toBe(409);
    });

    it('exige blocos alvo quando o publico e por bloco', async () => {
      const response = await admin.post('/announcements').send({
        condominiumId: ctx.seed.condominiumId,
        title: 'Aviso para a Torre A',
        content: 'Conteudo do aviso.',
        audience: 'BLOCKS',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/bloco/i);
    });

    it('conclui manutencao recorrente e reprograma a proxima', async () => {
      const upcoming = await admin.get(
        `/maintenances/upcoming?condominiumId=${ctx.seed.condominiumId}`,
      );
      const recurring = upcoming.body.data.find(
        (item: { recurrence: string }) => item.recurrence !== 'NONE',
      );

      const completed = await admin
        .post(`/maintenances/${recurring.id}/complete`)
        .send({ finalCost: 1500, scheduleNext: true });

      expect(completed.status).toBe(200);
      expect(completed.body.data.maintenance.status).toBe('COMPLETED');
      expect(completed.body.data.nextId).toBeTruthy();

      const next = await admin.get(`/maintenances/${completed.body.data.nextId}`);
      expect(next.body.data.status).toBe('SCHEDULED');
      expect(dayjs(next.body.data.scheduledFor).isAfter(dayjs())).toBe(true);
    });

    it('impede concluir duas vezes a mesma manutencao', async () => {
      const completed = await admin.get(
        `/maintenances?condominiumId=${ctx.seed.condominiumId}&status=COMPLETED&perPage=1`,
      );

      const response = await admin
        .post(`/maintenances/${completed.body.data[0].id}/complete`)
        .send({});

      expect(response.status).toBe(409);
    });
  });

  describe('notificacoes', () => {
    it('conta e marca notificacoes como lidas', async () => {
      const before = await morador.get('/notifications/unread-count');
      expect(before.body.data.unread).toBeGreaterThan(0);

      const read = await morador.post('/notifications/read').send({});
      expect(read.status).toBe(200);
      expect(read.body.data.updated).toBeGreaterThan(0);

      const after = await morador.get('/notifications/unread-count');
      expect(after.body.data.unread).toBe(0);
    });

    it('nao entrega notificacoes de outro usuario', async () => {
      const response = await morador.get('/notifications?perPage=100');

      expect(response.status).toBe(200);
      for (const notification of response.body.data) {
        expect(notification.userId).toBe(ctx.seed.users.morador.id);
      }
    });
  });
});
