import { AppDataSource } from '@/config/data-source';
import {
  anonymizePersonalData,
  isAnonymizedName,
  ANONYMIZED_LABEL,
} from '@/modules/lgpd/anonymize';
import { lgpdService, LgpdDuplicateRequestError } from '@/modules/lgpd/lgpd.service';
import { LgpdRequest } from '@/modules/lgpd/lgpd-request.entity';
import { chargeRepository } from '@/modules/financial/repositories/charge.repository';
import { commonAreaRepository } from '@/modules/common-areas/common-area.repository';
import { dependentRepository } from '@/modules/dependents/dependent.repository';
import { lgpdRequestRepository } from '@/modules/lgpd/lgpd-request.repository';
import { reservationRepository } from '@/modules/reservations/reservation.repository';
import { residentRepository } from '@/modules/residents/resident.repository';
import { vehicleRepository } from '@/modules/vehicles/vehicle.repository';
import { unitRepository } from '@/modules/units/unit.repository';
import { blockRepository } from '@/modules/blocks/block.repository';
import { Resident } from '@/modules/residents/resident.entity';
import type { TenantScope } from '@/shared/repositories/types';
import type { RequestContext } from '@/shared/services/request-context';
import { setupTestContext, teardownTestContext, type TestContext } from '../helpers/test-context';
import * as anonymizeModule from '@/modules/lgpd/anonymize';

describe('LGPD - anonimizacao e ciclo de vida das solicitacoes (UT-001..011)', () => {
  let ctx: TestContext;
  let scope: TenantScope;
  let unitIds: string[];
  let unitIndex = 0;
  let residentsIndex = 0;

  async function nextUnitId(): Promise<string> {
    const id = unitIds[unitIndex % unitIds.length];
    unitIndex += 1;
    return id;
  }

  const openScope = (): TenantScope => ({
    tenantId: ctx.seed.tenantId,
    condominiumIds: [],
  });

  const residentCtx = (actor: {
    userId: string;
    email: string;
    name: string;
    permissions: string[];
    unitId?: string | null;
    condominiumIds?: string[];
  }): RequestContext => ({
    scope: {
      tenantId: ctx.seed.tenantId,
      condominiumIds: actor.condominiumIds ?? [ctx.seed.condominiumId],
    },
    actor: {
      userId: actor.userId,
      tenantId: ctx.seed.tenantId,
      email: actor.email,
      name: actor.name,
      roleId: '',
      roleName: 'RESIDENT',
      permissions: actor.permissions,
      condominiumIds: actor.condominiumIds ?? [ctx.seed.condominiumId],
      unitId: actor.unitId ?? null,
      isSuperAdmin: false,
      sessionId: 'sess-test',
    },
    ipAddress: '127.0.0.1',
  });

  const moradorCtx = (): RequestContext =>
    residentCtx({
      userId: ctx.seed.users.morador.id,
      email: ctx.seed.users.morador.email,
      name: 'Morador',
      permissions: [
        'lgpd-request:create',
        'lgpd-consent:read',
        'lgpd-consent:create',
        'resident:read',
      ],
    });

  const adminCtx = (): RequestContext =>
    residentCtx({
      userId: ctx.seed.users.admin.id,
      email: ctx.seed.users.admin.email,
      name: 'Admin',
      permissions: ['lgpd-request:manage'],
      condominiumIds: [],
    });

  async function createResident(name = 'Residente Teste'): Promise<Resident> {
    residentsIndex += 1;
    const freshUnitId = await nextUnitId();
    return residentRepository.create(openScope(), {
      condominiumId: ctx.seed.condominiumId,
      unitId: freshUnitId,
      name: `${name} ${residentsIndex}`,
      document: `1112223334${residentsIndex % 10}`,
      email: `lgpd-ut${residentsIndex}@exemplo.com.br`,
      phone: '(11) 91000-0000',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    });
  }

  async function createPendingRequest(residentId: string): Promise<string> {
    const created = await lgpdRequestRepository.create(openScope(), {
      condominiumId: ctx.seed.condominiumId,
      residentId,
      status: 'PENDING',
      requestedAt: new Date(),
      notes: null,
    });
    return created.id;
  }

  beforeAll(async () => {
    ctx = await setupTestContext();
    scope = openScope();
    const [block] = await blockRepository.findAllBy(scope, {});
    const created = [];
    for (let index = 0; index < 20; index += 1) {
      created.push(
        unitRepository.create(scope, {
          condominiumId: ctx.seed.condominiumId,
          blockId: block.id,
          number: `9${String(31 + index)}`,
          type: 'APARTMENT',
          status: 'OCCUPIED',
          area: 72,
        }),
      );
    }
    unitIds = (await Promise.all(created)).map((unit) => unit.id);
    await AppDataSource.getRepository(LgpdRequest).clear();
  });

  afterAll(teardownTestContext);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('UT-001 - anonymizePersonalData anonimiza morador, dependentes e veiculo', async () => {
    const resident = await createResident('Alvo Um');
    await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Dependente 1',
      relationship: 'CHILD',
    });
    await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Dependente 2',
      relationship: 'CHILD',
    });
    await vehicleRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      plate: 'ABC1D23',
      brand: 'Fiat',
      model: 'Argo',
      color: 'Prata',
      type: 'CAR',
      year: 2021,
      status: 'ACTIVE',
    });

    const result = await anonymizePersonalData(scope, resident.id);

    expect(result).toEqual({
      residentsAnonymized: 1,
      dependentsAnonymized: 2,
      vehiclesAnonymized: 1,
    });
    const reloaded = (await residentRepository.findById(scope, resident.id)) as Resident;
    expect(reloaded.name).toContain('REDACTED-');
    expect(reloaded.document).toBe('000.000.000-00');
    expect(reloaded.userId).toBeNull();
    const dependents = await dependentRepository.findAllBy(scope, { residentId: resident.id });
    expect(dependents.map((dependent) => isAnonymizedName(dependent.name))).toEqual([true, true]);
    const vehicles = await vehicleRepository.findAllBy(scope, { unitId: resident.unitId });
    expect(vehicles[0].residentId).toBeNull();
  });

  it('UT-002 - cobrancas em aberto sao preservadas apos a anonimizacao', async () => {
    const resident = await createResident('Cobrancar');
    await chargeRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      description: 'Taxa condominial',
      referenceMonth: '2026-08',
      dueDate: '2026-08-10',
      amount: 487.5,
      status: 'PENDING',
    });

    await anonymizePersonalData(scope, resident.id);

    const charges = await chargeRepository.findAllBy(scope, { unitId: resident.unitId });
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBe(487.5);
    expect(charges[0].status).toBe('PENDING');
  });

  it('UT-003 - createDeleteRequest recusa pedido duplicado pendente', async () => {
    const morador = (await residentRepository.findOneBy(scope, {
      userId: ctx.seed.users.morador.id,
    })) as Resident;
    await createPendingRequest(morador.id);

    await expect(
      lgpdService.createDeleteRequest(moradorCtx(), { condominiumId: ctx.seed.condominiumId }),
    ).rejects.toBeInstanceOf(LgpdDuplicateRequestError);

    await AppDataSource.getRepository(LgpdRequest).clear();
  });

  it('UT-004 - morador sem consentimento registrado ainda pode solicitar', async () => {
    const morador = (await residentRepository.findOneBy(scope, {
      userId: ctx.seed.users.morador.id,
    })) as Resident;
    await residentRepository.update(scope, morador.id, { lgpdConsentAt: null });
    await AppDataSource.getRepository(LgpdRequest).clear();

    const result = await lgpdService.createDeleteRequest(moradorCtx(), {
      condominiumId: ctx.seed.condominiumId,
    });

    expect(result.status).toBe('PENDING');

    await lgpdRequestRepository.softDelete(scope, result.id);
    await residentRepository.update(scope, morador.id, { lgpdConsentAt: new Date() });
  });

  it('UT-005 - executeDelete transita a solicitacao para EXECUTED', async () => {
    const resident = await createResident('Executa');
    const requestId = await createPendingRequest(resident.id);

    const result = await lgpdService.executeDelete(adminCtx(), requestId);

    expect(result.status).toBe('EXECUTED');
    expect(result.executedAt).toBeInstanceOf(Date);
    expect(result.residentsAnonymized).toBe(1);
    const request = await lgpdRequestRepository.findById(scope, requestId);
    expect(request?.status).toBe('EXECUTED');
    expect(request?.executedAt).toBeDefined();
  });

  it('UT-006 - falha de banco durante a anonimizacao reverte e mantem PENDING', async () => {
    const resident = await createResident('Falha');
    const requestId = await createPendingRequest(resident.id);

    jest
      .spyOn(anonymizeModule, 'anonymizePersonalData')
      .mockRejectedValueOnce(new Error('falha de rede'));

    await expect(lgpdService.executeDelete(adminCtx(), requestId)).rejects.toThrow('falha de rede');

    const request = await lgpdRequestRepository.findById(scope, requestId);
    expect(request?.status).toBe('PENDING');
    expect(request?.executedAt).toBeNull();
  });

  it('UT-007 - anonimizacao em cascata aplica-se a todos os dependentes', async () => {
    const resident = await createResident('Cascata');
    await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Filha A',
      relationship: 'CHILD',
      document: '11122233301',
      birthDate: '2015-04-12',
      phone: '(11) 98111-0001',
    });
    await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Filho B',
      relationship: 'CHILD',
      document: '11122233302',
      birthDate: '2017-08-20',
    });

    await anonymizePersonalData(scope, resident.id);

    const dependents = await dependentRepository.findAllBy(scope, { residentId: resident.id });
    for (const dependent of dependents) {
      expect(dependent.name).toContain('REDACTED-');
      expect(dependent.birthDate).toBeNull();
    }
  });

  it('UT-008 - reservas futuras sao preservadas com nome anonimizado', async () => {
    const resident = await createResident('Reservado');
    const [area] = await commonAreaRepository.findAllBy(scope, {});
    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await reservationRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: area.id,
      unitId: resident.unitId,
      requestedById: 'qualquer-user',
      requestedByName: 'Morador Reservado',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
      status: 'PENDING',
      guestsCount: 5,
    });

    await anonymizePersonalData(scope, resident.id);

    const reservations = await reservationRepository.findAllBy(scope, { unitId: resident.unitId });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].requestedByName).toBe(ANONYMIZED_LABEL);
    expect(reservations[0].requestedById).toBeNull();
    expect(reservations[0].startsAt.toISOString()).toBe(startsAt.toISOString());
  });

  it('UT-009 - valores e datas das cobrancas nao mudam, apenas o nome do morador', async () => {
    const resident = await createResident('Financeiro');
    await chargeRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      description: 'Condominio julho',
      referenceMonth: '2026-07',
      dueDate: '2026-07-10',
      amount: 520,
      status: 'PAID',
      paidAmount: 520,
    });

    await anonymizePersonalData(scope, resident.id);

    const residentReloaded = (await residentRepository.findById(scope, resident.id)) as Resident;
    expect(residentReloaded.name).toContain('REDACTED-');
    const charges = await chargeRepository.findAllBy(scope, { unitId: resident.unitId });
    expect(charges[0].amount).toBe(520);
    expect(charges[0].dueDate).toBe('2026-07-10');
    expect(charges[0].referenceMonth).toBe('2026-07');
  });

  it('UT-010 - execucoes concorrentes: a segunda recebe conflito', async () => {
    const resident = await createResident('Concorrente');
    const requestId = await createPendingRequest(resident.id);

    const first = lgpdService.executeDelete(adminCtx(), requestId);
    const second = lgpdService.executeDelete(adminCtx(), requestId);

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
  });

  it('UT-011 - morador sem registros financeiros: anonimizacao sem impacto', async () => {
    const resident = await createResident('SemFinancas');

    const result = await anonymizePersonalData(scope, resident.id);

    expect(result.residentsAnonymized).toBe(1);
    expect(result.dependentsAnonymized).toBe(0);
    expect(result.vehiclesAnonymized).toBe(0);
    const charges = await chargeRepository.findAllBy(scope, { unitId: resident.unitId });
    expect(charges).toHaveLength(0);
  });
});
