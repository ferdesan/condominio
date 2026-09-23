import { AppDataSource } from '@/config/data-source';
import { Vote } from '@/modules/assemblies/entities/vote.entity';
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

type StatusRow = { unitId: string; unitNumber: string; status: string };

describe('vote-status, elegibilidade e identidade de voto', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let morador: AuthenticatedAgent;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
    morador = await login(ctx, seedUsers.morador);
  });

  afterAll(teardownTestContext);

  async function createOpenPoll(
    overrides: Record<string, unknown> = {},
  ): Promise<{ pollId: string; optionIds: string[] }> {
    const created = await admin.post('/polls').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'Votacao de teste',
      voterType: 'ALL_RESIDENTS',
      weightedByFraction: false,
      startsAt: dayjs().subtract(1, 'hour').toISOString(),
      endsAt: dayjs().add(5, 'day').toISOString(),
      quorumPercent: 0,
      options: [{ label: 'Sim' }, { label: 'Nao' }],
      ...overrides,
    });

    expect(created.status).toBe(201);
    const pollId = created.body.data.id as string;
    const optionIds = created.body.data.options.map((option: { id: string }) => option.id);

    const opened = await admin.post(`/polls/${pollId}/open`).send({});
    expect(opened.status).toBe(200);

    return { pollId, optionIds };
  }

  async function voteStatusOf(pollId: string): Promise<StatusRow[]> {
    const response = await admin.get(`/polls/${pollId}/vote-status`);
    expect(response.status).toBe(200);
    return response.body.data as StatusRow[];
  }

  it('IT-393 devolve uma linha por unidade apenas com unitId unitNumber e status', async () => {
    const { pollId } = await createOpenPoll({ title: 'Status geral' });
    const rows = await voteStatusOf(pollId);

    expect(rows).toHaveLength(ctx.seed.unitIds.length);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['status', 'unitId', 'unitNumber']);
      expect(['VOTED', 'PENDING', 'NOT_ELIGIBLE']).toContain(row.status);
    }
  });

  it('IT-394 devolve 404 para poll desconhecido e 422 para id malformado', async () => {
    const unknown = await admin.get('/polls/00000000-0000-4000-8000-000000000000/vote-status');
    expect(unknown.status).toBe(404);

    const malformed = await admin.get('/polls/nao-e-uuid/vote-status');
    expect(malformed.status).toBe(422);
  });

  it('IT-377 recusa vote-status e voto proxy sem vote:manage', async () => {
    const { pollId, optionIds } = await createOpenPoll({ title: 'Permissao manage' });

    const status = await morador.get(`/polls/${pollId}/vote-status`);
    expect(status.status).toBe(403);

    const proxy = await morador
      .post(`/polls/${pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[1], optionId: optionIds[0] });
    expect(proxy.status).toBe(403);
  });

  it('IT-369 my-vote nao-secreto devolve optionId e votedAt apos o voto', async () => {
    const { pollId, optionIds } = await createOpenPoll({ title: 'My vote aberto' });

    const vote = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });
    expect(vote.status).toBe(200);

    const myVote = await morador.get(`/polls/${pollId}/my-vote`);
    expect(myVote.status).toBe(200);
    expect(myVote.body.data).toMatchObject({ voted: true, optionId: optionIds[0] });
    expect(myVote.body.data.votedAt).toBeTruthy();
  });

  it('IT-370 my-vote secreto devolve apenas voted true sem optionId', async () => {
    const { pollId, optionIds } = await createOpenPoll({ title: 'My vote secreto', isSecret: true });

    const vote = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });
    expect(vote.status).toBe(200);

    const myVote = await morador.get(`/polls/${pollId}/my-vote`);
    expect(myVote.status).toBe(200);
    expect(myVote.body.data).toEqual({ voted: true });
  });

  it('IT-385 vote-status responde 200 em votacao secreta', async () => {
    const { pollId } = await createOpenPoll({ title: 'Status secreto', isSecret: true });
    const rows = await voteStatusOf(pollId);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['status', 'unitId', 'unitNumber']);
      expect(['VOTED', 'PENDING', 'NOT_ELIGIBLE']).toContain(row.status);
    }
  });

  it('IT-386 listagem bruta de votos continua 403 em votacao secreta', async () => {
    const { pollId } = await createOpenPoll({ title: 'Votes secretos', isSecret: true });

    const response = await admin.get(`/polls/${pollId}/votes`);
    expect(response.status).toBe(403);
  });

  it('IT-380 recusa proxy em unidade sem OWNER ativo em votacao de proprietarios', async () => {
    const { pollId, optionIds } = await createOpenPoll({
      title: 'Owners sem proprietario',
      voterType: 'OWNERS',
    });

    const statusRows = await voteStatusOf(pollId);
    const vacant = statusRows.find((row) => row.unitId === ctx.seed.unitIds[15]);
    expect(vacant?.status).toBe('NOT_ELIGIBLE');

    const response = await admin
      .post(`/polls/${pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[15], optionId: optionIds[0] });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/proprietarios/i);
  });

  it('IT-395 aceita proxy em unidade sem OWNER quando a votacao e de todos os moradores', async () => {
    const { pollId, optionIds } = await createOpenPoll({
      title: 'All residents sem proprietario',
      voterType: 'ALL_RESIDENTS',
    });

    const response = await admin
      .post(`/polls/${pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[15], optionId: optionIds[0] });
    expect(response.status).toBe(200);
    expect(response.body.data.totalVotes).toBe(1);
  });

  it('IT-387 grava identidade do residente no proxy nao-secreto e null no secreto', async () => {
    const open = await createOpenPoll({ title: 'Identidade aberta' });
    const secret = await createOpenPoll({ title: 'Identidade secreta', isSecret: true });

    const openProxy = await admin
      .post(`/polls/${open.pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[0], optionId: open.optionIds[0] });
    expect(openProxy.status).toBe(200);

    const openVote = await AppDataSource.getRepository(Vote).findOne({
      where: { pollId: open.pollId, unitId: ctx.seed.unitIds[0] },
    });
    expect(openVote).toBeTruthy();
    expect(openVote!.registeredByUserId).toBe(admin.userId);
    expect(openVote!.voterId).toBe(ctx.seed.users.morador.id);
    expect(openVote!.voterName).toBeTruthy();

    const secretProxy = await admin
      .post(`/polls/${secret.pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[1], optionId: secret.optionIds[0] });
    expect(secretProxy.status).toBe(200);

    const secretVote = await AppDataSource.getRepository(Vote).findOne({
      where: { pollId: secret.pollId, unitId: ctx.seed.unitIds[1] },
    });
    expect(secretVote).toBeTruthy();
    expect(secretVote!.registeredByUserId).toBe(admin.userId);
    expect(secretVote!.voterId).toBeNull();
    expect(secretVote!.voterName).toBeNull();
  });

  it('IT-396 mantem self-vote proxy e results estaveis apos o cleanup', async () => {
    const { pollId, optionIds } = await createOpenPoll({ title: 'Regressao cleanup' });

    const selfVote = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });
    expect(selfVote.status).toBe(200);
    expect(selfVote.body.data.totalVotes).toBe(1);
    expect(
      selfVote.body.data.options.find((option: { id: string }) => option.id === optionIds[0])
        .votesCount,
    ).toBe(1);

    const proxy = await admin
      .post(`/polls/${pollId}/votes`)
      .send({ unitId: ctx.seed.unitIds[1], optionId: optionIds[1] });
    expect(proxy.status).toBe(200);
    expect(proxy.body.data.totalVotes).toBe(2);

    const results = await admin.get(`/polls/${pollId}/results`);
    expect(results.status).toBe(200);
    expect(results.body.data.totalVotes).toBe(2);
    expect(results.body.data.options).toHaveLength(2);
  });

  it('IT-397 OWNERS vira NOT_ELIGIBLE e 403 sem OWNER e PENDING e 200 apos virar OWNER', async () => {
    const { pollId, optionIds } = await createOpenPoll({
      title: 'Matriz de elegibilidade',
      voterType: 'OWNERS',
    });
    const unitId = ctx.seed.unitIds[3];
    const residents = AppDataSource.getRepository(Resident);
    const resident = await residents.findOne({
      where: { tenantId: ctx.seed.tenantId, unitId },
    });
    expect(resident).toBeTruthy();
    expect(resident!.type).toBe('TENANT');

    const before = await voteStatusOf(pollId);
    expect(before.find((row) => row.unitId === unitId)?.status).toBe('NOT_ELIGIBLE');

    const denied = await admin
      .post(`/polls/${pollId}/votes`)
      .send({ unitId, optionId: optionIds[0] });
    expect(denied.status).toBe(403);

    await residents.update(resident!.id, { type: 'OWNER' });

    try {
      const mid = await voteStatusOf(pollId);
      expect(mid.find((row) => row.unitId === unitId)?.status).toBe('PENDING');

      const allowed = await admin
        .post(`/polls/${pollId}/votes`)
        .send({ unitId, optionId: optionIds[0] });
      expect(allowed.status).toBe(200);
    } finally {
      await residents.update(resident!.id, { type: 'TENANT' });
    }
  });

  it('self-vote OWNERS recusa unidade sem OWNER ativo (mesma regra do proxy)', async () => {
    const { pollId, optionIds } = await createOpenPoll({
      title: 'Self-vote owners',
      voterType: 'OWNERS',
    });
    const residents = AppDataSource.getRepository(Resident);
    const resident = await residents.findOne({
      where: { tenantId: ctx.seed.tenantId, userId: ctx.seed.users.morador.id },
    });
    expect(resident).toBeTruthy();

    await residents.update(resident!.id, { type: 'TENANT' });
    try {
      const denied = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });
      expect(denied.status).toBe(403);
      expect(denied.body.error.message).toMatch(/proprietarios/i);
    } finally {
      await residents.update(resident!.id, { type: 'OWNER' });
    }
  });

  it('PATCH nao troca status e recusa regra apos abrir', async () => {
    const { pollId } = await createOpenPoll({ title: 'Patch bloqueado' });

    const statusPatch = await admin.patch(`/polls/${pollId}`).send({ status: 'DRAFT' });
    expect(statusPatch.status).toBe(200);
    expect(statusPatch.body.data.status).toBe('OPEN');

    const rulePatch = await admin.patch(`/polls/${pollId}`).send({ voterType: 'OWNERS' });
    expect(rulePatch.status).toBe(409);
    expect(rulePatch.body.error.message).toMatch(/publico/i);

    const secretPatch = await admin.patch(`/polls/${pollId}`).send({ isSecret: true });
    expect(secretPatch.status).toBe(409);
    expect(secretPatch.body.error.message).toMatch(/segredo/i);
  });

  it('close em rascunho e recusado (so OPEN pode fechar)', async () => {
    const created = await admin.post('/polls').send({
      condominiumId: ctx.seed.condominiumId,
      title: 'Rascunho nao fecha',
      voterType: 'ALL_RESIDENTS',
      startsAt: dayjs().subtract(1, 'hour').toISOString(),
      endsAt: dayjs().add(1, 'day').toISOString(),
      options: [{ label: 'Sim' }, { label: 'Nao' }],
    });
    expect(created.status).toBe(201);

    const closed = await admin.post(`/polls/${created.body.data.id}/close`).send({});
    expect(closed.status).toBe(409);
    expect(closed.body.error.message).toMatch(/abertas/i);
  });

  it('voto secreto nao grava ipAddress no registro', async () => {
    const { pollId, optionIds } = await createOpenPoll({
      title: 'Ip secreto',
      isSecret: true,
    });

    const vote = await morador.post(`/polls/${pollId}/vote`).send({ optionId: optionIds[0] });
    expect(vote.status).toBe(200);

    const row = await AppDataSource.getRepository(Vote).findOne({
      where: { pollId, unitId: ctx.seed.unitIds[0] },
    });
    expect(row).toBeTruthy();
    expect(row!.ipAddress).toBeNull();
    expect(row!.voterId).toBeNull();
  });
});
