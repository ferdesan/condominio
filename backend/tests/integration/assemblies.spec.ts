import { AppDataSource } from '@/config/data-source';
import { Resident } from '@/modules/residents/resident.entity';
import { dayjs } from '@/shared/utils/date.util';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Assembleias e votacao online', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let morador: AuthenticatedAgent;
  let assemblyId: string;
  let pollId: string;
  let optionIds: string[];

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    morador = await login(ctx, seedUsers.morador);
  });

  afterAll(teardownTestContext);

  it('convoca uma assembleia e notifica os moradores', async () => {
    const scheduledAt = dayjs().add(20, 'day').hour(19).minute(0).second(0).millisecond(0);

    const response = await admin.post('/assemblies').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'AGE - Reforma da fachada',
      description: 'Deliberacao sobre a contratacao da reforma.',
      type: 'EXTRAORDINARY',
      mode: 'HYBRID',
      scheduledAt: scheduledAt.toISOString(),
      secondCallAt: scheduledAt.add(30, 'minute').toISOString(),
      location: 'Salao de Festas',
      quorumPercent: 50,
    });

    expect(response.status).toBe(201);
    assemblyId = response.body.data.id;

    const notifications = await morador.get('/notifications');
    const titles = notifications.body.data.map((item: { title: string }) => item.title);
    expect(titles.some((title: string) => title.includes('Convocacao'))).toBe(true);
  });

  it('recusa segunda convocacao anterior a primeira', async () => {
    const scheduledAt = dayjs().add(25, 'day');

    const response = await admin.post('/assemblies').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'Assembleia invalida',
      scheduledAt: scheduledAt.toISOString(),
      secondCallAt: scheduledAt.subtract(2, 'hour').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/segunda convocacao/i);
  });

  it('cria uma votacao vinculada a assembleia com opcoes', async () => {
    const response = await admin.post('/polls').send({
      condominiumId: ctx.seed.condominiumId,
      assemblyId,
      title: 'Aprova a reforma da fachada?',
      voterType: 'ALL_RESIDENTS',
      weightedByFraction: false,
      startsAt: dayjs().subtract(1, 'hour').toISOString(),
      endsAt: dayjs().add(10, 'day').toISOString(),
      quorumPercent: 30,
      options: [{ label: 'Aprovo' }, { label: 'Rejeito' }, { label: 'Abstencao' }],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.options).toHaveLength(3);
    expect(response.body.data.eligibleUnits).toBeGreaterThan(0);

    pollId = response.body.data.id;
    optionIds = response.body.data.options.map((option: { id: string }) => option.id);
  });

  it('exige ao menos duas opcoes de voto', async () => {
    const response = await admin.post('/polls').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'Votacao invalida',
      startsAt: dayjs().toISOString(),
      endsAt: dayjs().add(1, 'day').toISOString(),
      options: [{ label: 'Unica opcao' }],
    });

    expect(response.status).toBe(422);
  });

  it('nao aceita voto enquanto a votacao esta em rascunho', async () => {
    const response = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/nao esta aberta/i);
  });

  it('abre a votacao e registra o voto da unidade', async () => {
    const opened = await admin.post(`/polls/${pollId}/open`).send({});
    expect(opened.status).toBe(200);
    expect(opened.body.data.status).toBe('OPEN');

    const vote = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });

    expect(vote.status).toBe(200);
    expect(vote.body.data.totalVotes).toBe(1);

    const chosen = vote.body.data.options.find((option: { id: string }) => option.id === optionIds[0]);
    expect(chosen.votesCount).toBe(1);
    expect(chosen.percent).toBe(100);
  });

  it('impede a mesma unidade de votar duas vezes', async () => {
    const response = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[1] });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/ja registrou voto/i);
  });

  it('impede voto de usuario sem unidade vinculada', async () => {
    const sindico = await login(ctx, seedUsers.sindico);
    const response = await sindico.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/vinculados a uma unidade/i);
  });

  it('restringe deliberacao de proprietarios a quem e proprietario', async () => {
    // O morador do seed e proprietario: trocamos o tipo para validar a regra.
    const residents = AppDataSource.getRepository(Resident);
    const resident = await residents.findOne({
      where: { tenantId: ctx.seed.tenantId, userId: ctx.seed.users.morador.id },
    });
    await residents.update(resident!.id, { type: 'TENANT' });

    const ownersPoll = await admin.post('/polls').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'Deliberacao exclusiva de proprietarios',
      voterType: 'OWNERS',
      startsAt: dayjs().subtract(1, 'hour').toISOString(),
      endsAt: dayjs().add(5, 'day').toISOString(),
      options: [{ label: 'Sim' }, { label: 'Nao' }],
    });
    await admin.post(`/polls/${ownersPoll.body.data.id}/open`).send({});

    const response = await morador
      .post(`/polls/${ownersPoll.body.data.id}/vote`)
      .send({ optionId: ownersPoll.body.data.options[0].id });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/proprietarios/i);

    await residents.update(resident!.id, { type: 'OWNER' });
  });

  it('apura o resultado com quorum e percentuais', async () => {
    const response = await admin.get(`/polls/${pollId}/results`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ totalVotes: 1, quorumPercent: 30 });
    expect(response.body.data.participationPercent).toBeGreaterThan(0);
    expect(typeof response.body.data.quorumReached).toBe('boolean');
  });

  it('encerra a votacao e publica o resultado', async () => {
    const response = await admin.post(`/polls/${pollId}/close`).send({});

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CLOSED');
  });

  it('nao aceita voto apos o encerramento', async () => {
    const response = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[2] });

    expect(response.status).toBe(409);
  });

  it('inicia e encerra a assembleia anexando a ata', async () => {
    const started = await admin.post(`/assemblies/${assemblyId}/start`).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');

    const finished = await admin.post(`/assemblies/${assemblyId}/finish`).send({
      minutesUrl: 'https://exemplo.com/ata-age-2026.pdf',
      attendeesCount: 24,
    });

    expect(finished.status).toBe(200);
    expect(finished.body.data.status).toBe('FINISHED');
    expect(finished.body.data.attendeesCount).toBe(24);
    expect(finished.body.data.finishedAt).toBeTruthy();
  });

  it('nao permite alterar assembleia encerrada', async () => {
    const response = await admin.patch(`/assemblies/${assemblyId}`).send({ title: 'Nova tentativa' });

    expect(response.status).toBe(409);
  });
});
