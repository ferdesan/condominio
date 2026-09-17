import request from 'supertest';
import { AppDataSource } from '@/config/data-source';
import { auditRepository } from '@/modules/audit/audit.repository';
import { blockRepository } from '@/modules/blocks/block.repository';
import { commonAreaRepository } from '@/modules/common-areas/common-area.repository';
import { condominiumRepository } from '@/modules/condominiums/condominium.repository';
import { dependentRepository } from '@/modules/dependents/dependent.repository';
import { chargeRepository } from '@/modules/financial/repositories/charge.repository';
import { paymentRepository } from '@/modules/financial/repositories/payment.repository';
import type { Charge } from '@/modules/financial/entities/charge.entity';
import { LgpdConsent } from '@/modules/lgpd/lgpd-consent.entity';
import { lgpdConsentRepository } from '@/modules/lgpd/lgpd-consent.repository';
import { LgpdRequest } from '@/modules/lgpd/lgpd-request.entity';
import { lgpdRequestRepository } from '@/modules/lgpd/lgpd-request.repository';
import { lgpdExportPayloadSchema } from '@/modules/lgpd/lgpd.schema';
import * as anonymizeModule from '@/modules/lgpd/anonymize';
import { reservationRepository } from '@/modules/reservations/reservation.repository';
import { residentRepository } from '@/modules/residents/resident.repository';
import { unitRepository } from '@/modules/units/unit.repository';
import { vehicleRepository } from '@/modules/vehicles/vehicle.repository';
import type { Resident } from '@/modules/residents/resident.entity';
import type { TenantScope } from '@/shared/repositories/types';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('LGPD - integracao (IT-001..048)', () => {
  let ctx: TestContext;
  let adminAgent: AuthenticatedAgent;
  let sindicoAgent: AuthenticatedAgent;
  let porteiroAgent: AuthenticatedAgent;
  let moradorAgent: AuthenticatedAgent;
  let moradorResident: Resident;
  let moradorResidentId: string;
  let moradorUnitId: string;
  let moradorVehicleId: string;
  let unitPool: string[];
  let unitIndex = 0;
  let counter = 0;
  let condo2Id: string;
  let condo2Resident: Resident;

  const openScope = (): TenantScope => ({
    tenantId: ctx.seed.tenantId,
    condominiumIds: [],
  });

  let rmResidentA: Resident;

  async function freshUnitId(): Promise<string> {
    const id = unitPool[unitIndex % unitPool.length];
    unitIndex += 1;
    return id;
  }

  async function createDedicatedResident(name: string): Promise<Resident> {
    counter += 1;
    const unitId = await freshUnitId();
    return (await residentRepository.create(openScope(), {
      condominiumId: ctx.seed.condominiumId,
      unitId,
      name: `${name} ${counter}`,
      document: `55${String(100000000 + counter)}`,
      email: `it-lgpd${counter}@exemplo.com.br`,
      phone: '(11) 93000-0000',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    })) as Resident;
  }

  async function createRequest(
    residentId: string,
    status: 'PENDING' | 'EXECUTED' | 'CANCELLED' = 'PENDING',
    condominiumId: string = ctx.seed.condominiumId,
  ): Promise<LgpdRequest> {
    return (await lgpdRequestRepository.create(openScope(), {
      condominiumId,
      residentId,
      status,
      requestedAt: new Date(),
      executedAt: status === 'EXECUTED' ? new Date() : null,
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
    })) as LgpdRequest;
  }

  async function addVehicle(resident: Resident, plateSuffix: number): Promise<{ id: string }> {
    return (await vehicleRepository.create(openScope(), {
      condominiumId: resident.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      plate: `ITV${String(plateSuffix).padStart(3, '0')}`,
      brand: 'Fiat',
      model: 'Argo',
      color: 'Prata',
      type: 'CAR',
      year: 2021,
      status: 'ACTIVE',
    })) as { id: string };
  }

  async function addDependent(resident: Resident, suffix: number): Promise<{ id: string }> {
    return (await dependentRepository.create(openScope(), {
      condominiumId: resident.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: `Dependente ${suffix} de ${resident.name}`,
      relationship: 'CHILD',
      document: `66${String(100000000 + suffix)}`,
      birthDate: '2010-01-01',
      phone: '(11) 90000-0000',
      hasAccessCard: false,
      active: true,
    })) as { id: string };
  }

  async function addCharge(
    resident: Resident,
    suffix: number,
    status: 'PENDING' | 'PAID' | 'OVERDUE' = 'PENDING',
  ): Promise<Charge> {
    return (await chargeRepository.create(openScope(), {
      condominiumId: resident.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      description: `Taxa teste ${suffix}`,
      referenceMonth: '2026-09',
      dueDate: '2026-09-10',
      amount: 450 + suffix,
      status,
    })) as Charge;
  }

  async function addPayment(charge: Charge): Promise<{ id: string }> {
    return (await paymentRepository.create(openScope(), {
      condominiumId: charge.condominiumId,
      chargeId: charge.id,
      amount: charge.amount,
      paidAt: new Date(),
      method: 'PIX',
    })) as { id: string };
  }

  async function addReservation(resident: Resident): Promise<{ id: string }> {
    const area = await commonAreaRepository.findOneBy(openScope(), {});
    return (await reservationRepository.create(openScope(), {
      condominiumId: resident.condominiumId,
      commonAreaId: area!.id,
      unitId: resident.unitId,
      requestedById: resident.id,
      requestedByName: resident.name,
      startsAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      endsAt: new Date(Date.now() + 3 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
      status: 'CONFIRMED',
      guestsCount: 8,
      fee: 50,
    })) as { id: string };
  }

  beforeAll(async () => {
    ctx = await setupTestContext();

    adminAgent = await login(ctx, seedUsers.admin);
    sindicoAgent = await login(ctx, seedUsers.sindico);
    porteiroAgent = await login(ctx, seedUsers.porteiro);
    moradorAgent = await login(ctx, seedUsers.morador);

    moradorResident = (await residentRepository.findOneBy(openScope(), {
      userId: moradorAgent.userId,
    })) as Resident;
    moradorResidentId = moradorResident.id;
    moradorUnitId = moradorResident.unitId;
    const vehicle = await vehicleRepository.findOneBy(openScope(), {
      residentId: moradorResidentId,
    });
    moradorVehicleId = vehicle!.id;

    const [block] = await blockRepository.findAllBy(openScope(), {});
    const createdUnits = [];
    for (let index = 0; index < 40; index += 1) {
      createdUnits.push(
        unitRepository.create(openScope(), {
          condominiumId: ctx.seed.condominiumId,
          blockId: block.id,
          number: `7${String(301 + index)}`,
          type: 'APARTMENT',
          status: 'OCCUPIED',
          area: 70,
        }),
      );
    }
    unitPool = (await Promise.all(createdUnits)).map((unit) => unit.id);

    const condo2 = await condominiumRepository.create(openScope(), {
      name: 'Residencial Horizonte Azul',
      type: 'RESIDENTIAL',
      chargeDueDay: 5,
    });
    condo2Id = condo2.id;
    const block2 = await blockRepository.create(openScope(), {
      condominiumId: condo2Id,
      name: 'Bloco Unico',
      type: 'BLOCK',
      floors: 1,
      unitsPerFloor: 2,
    });
    const unit2 = await unitRepository.create(openScope(), {
      condominiumId: condo2Id,
      blockId: block2.id,
      number: 'U2-01',
      type: 'APARTMENT',
      status: 'OCCUPIED',
      area: 60,
    });
    condo2Resident = (await residentRepository.create(openScope(), {
      condominiumId: condo2Id,
      unitId: unit2.id,
      name: 'Residente Horizonte',
      document: '99900000011',
      email: 'horizonte@exemplo.com.br',
      phone: '(11) 99999-0000',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    })) as Resident;
    await chargeRepository.create(openScope(), {
      condominiumId: condo2Id,
      unitId: unit2.id,
      residentId: condo2Resident.id,
      description: 'Taxa Horizonte',
      referenceMonth: '2026-09',
      dueDate: '2026-09-10',
      amount: 320,
      status: 'PENDING',
    });
  });

  afterAll(teardownTestContext);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Deletion requests (IT-001..024)', () => {
    let rmResidentB: Resident;
    let rmResidentC: Resident;
    let rmResidentD: Resident;
    let rmResidentE: Resident;
    let rmResidentF: Resident;
    let rmResidentR: Resident;
    let requestForA: LgpdRequest;
    let requestForE: LgpdRequest;

    it('IT-001 - POST /lgpd/delete-request como morador autenticado cria pedido PENDING', async () => {
      const response = await moradorAgent
        .post('/lgpd/delete-request')
        .send({
          condominiumId: ctx.seed.condominiumId,
          notes: 'Motivo: Lei Geral de Protecao de Dados',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.residentId).toBe(moradorResidentId);
    });

    it('IT-002 - POST /lgpd/delete-request sem autenticacao retorna 401', async () => {
      const response = await request(ctx.app)
        .post(`${ctx.api}/lgpd/delete-request`)
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(401);
    });

    it('IT-003 - POST /lgpd/delete-request com cobrancas ativas retorna aviso', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();
      const response = await moradorAgent
        .post('/lgpd/delete-request')
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
      expect(Array.isArray(response.body.data.warnings)).toBe(true);
      expect(
        response.body.data.warnings.some((warning: string) => warning.includes('cobranca')),
      ).toBe(true);
    });

    it('IT-004 - POST /lgpd/delete-request duplicado (PENDING) retorna 409 LGPD_DUPLICATE_REQUEST', async () => {
      const response = await moradorAgent
        .post('/lgpd/delete-request')
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('LGPD_DUPLICATE_REQUEST');
    });

    it('IT-005 - POST /lgpd/delete-request sem consentimento registrado funciona (201)', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();
      await residentRepository.update(openScope(), moradorResidentId, {
        lgpdConsentAt: null,
      });
      const response = await moradorAgent
        .post('/lgpd/delete-request')
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('IT-006 - POST /lgpd/delete-request com falha de rede propaga o erro (500)', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();
      jest
        .spyOn(lgpdRequestRepository, 'create')
        .mockRejectedValueOnce(new Error('falha de rede nao simulada'));
      const response = await moradorAgent
        .post('/lgpd/delete-request')
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(500);
    });

    it('IT-007 - POST /lgpd/delete-request como nao-morador retorna erro (403)', async () => {
      const response = await porteiroAgent
        .post('/lgpd/delete-request')
        .send({ condominiumId: ctx.seed.condominiumId });

      expect(response.status).toBe(403);
    });

    it('IT-008 - POST /lgpd/delete-request/:id/execute anonimiza morador, dependente e veiculo', async () => {
      rmResidentA = await createDedicatedResident('Alvo Execucao');
      const dependentA = await addDependent(rmResidentA, 1);
      await addVehicle(rmResidentA, 101);
      requestForA = await createRequest(rmResidentA.id);

      const response = await adminAgent.post(`/lgpd/delete-request/${requestForA.id}/execute`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('EXECUTED');
      expect(response.body.data.residentsAnonymized).toBe(1);
      expect(response.body.data.dependentsAnonymized).toBe(1);
      expect(response.body.data.vehiclesAnonymized).toBe(1);

      const anonymized = (await residentRepository.findOneBy(openScope(), {
        id: rmResidentA.id,
      })) as Resident;
      expect(anonymized.name).toMatch(/^REDACTED-/);
      expect(anonymized.document).toBe('000.000.000-00');
      expect(anonymized.email).toBe('redacted@redacted.invalid');
      expect(anonymized.userId).toBeNull();

      const anonymizedDependent = await dependentRepository.findOneBy(openScope(), {
        id: dependentA.id,
      });
      expect(anonymizedDependent?.name).toMatch(/^REDACTED-/);

      const vehiclesOfA = await vehicleRepository.findAllBy(openScope(), {
        unitId: rmResidentA.unitId,
      });
      expect(vehiclesOfA).toHaveLength(1);
      expect(vehiclesOfA[0].residentId).toBeNull();
    });

    it('IT-011 - POST execute com dependentes anonimiza todos os registros', async () => {
      rmResidentB = await createDedicatedResident('Alvo Dependentes');
      await addDependent(rmResidentB, 2);
      await addDependent(rmResidentB, 3);
      const requestB = await createRequest(rmResidentB.id);

      const response = await adminAgent.post(`/lgpd/delete-request/${requestB.id}/execute`);

      expect(response.status).toBe(200);
      expect(response.body.data.dependentsAnonymized).toBe(2);

      const dependentsOfB = await dependentRepository.findAllBy(openScope(), {
        residentId: rmResidentB.id,
      });
      expect(dependentsOfB).toHaveLength(2);
      expect(dependentsOfB.map((dependent) => dependent.name)).toEqual([
        expect.stringMatching(/^REDACTED-/),
        expect.stringMatching(/^REDACTED-/),
      ]);
    });

    it('IT-009 - POST execute em pedido ja executado retorna 409', async () => {
      const response = await adminAgent.post(`/lgpd/delete-request/${requestForA.id}/execute`);

      expect(response.status).toBe(409);
    });

    it('IT-010 - POST execute com falha de transacao retorna 500 e mantem PENDING', async () => {
      rmResidentC = await createDedicatedResident('Alvo Transacao');
      const requestC = await createRequest(rmResidentC.id);

      jest
        .spyOn(anonymizeModule, 'anonymizePersonalData')
        .mockRejectedValueOnce(new Error('falha na transacao'));

      const response = await adminAgent.post(`/lgpd/delete-request/${requestC.id}/execute`);

      expect(response.status).toBe(500);

      const detail = await adminAgent.get(`/lgpd/delete-requests/${requestC.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.status).toBe('PENDING');
    });

    it('IT-012 - POST execute preserva reservas com nome anonimizado', async () => {
      rmResidentD = await createDedicatedResident('Alvo Reserva');
      const reservationD = await addReservation(rmResidentD);
      const requestD = await createRequest(rmResidentD.id);

      const response = await adminAgent.post(`/lgpd/delete-request/${requestD.id}/execute`);

      expect(response.status).toBe(200);
      const saved = await reservationRepository.findOneBy(openScope(), { id: reservationD.id });
      expect(saved?.requestedById).toBeNull();
      expect(saved?.requestedByName).toBe('Anonimizado');
      expect(saved?.status).toBe('CONFIRMED');
    });

    it('IT-013 - POST execute preserva cobrancas e pagamentos com valores inalterados', async () => {
      rmResidentE = await createDedicatedResident('Alvo Financeiro');
      const chargeE1 = await addCharge(rmResidentE, 11, 'OVERDUE');
      const chargeE2 = await addCharge(rmResidentE, 12, 'PAID');
      await addPayment(chargeE2);
      requestForE = await createRequest(rmResidentE.id);

      const response = await adminAgent.post(`/lgpd/delete-request/${requestForE.id}/execute`);

      expect(response.status).toBe(200);
      const chargesOfE = await chargeRepository.findAllBy(openScope(), {
        unitId: rmResidentE.unitId,
      });
      expect(chargesOfE).toHaveLength(2);
      const e1 = chargesOfE.find((charge) => charge.id === chargeE1.id);
      const e2 = chargesOfE.find((charge) => charge.id === chargeE2.id);
      expect(e1?.status).toBe('OVERDUE');
      expect(e1?.amount).toBe(461);
      expect(e2?.status).toBe('PAID');
      expect(e2?.amount).toBe(462);
    });

    it('IT-024 - delecao preserva os registros financeiros (US-005)', async () => {
      const chargesAfter = await chargeRepository.findAllBy(openScope(), {
        unitId: rmResidentE.unitId,
      });
      expect(chargesAfter.length).toBeGreaterThanOrEqual(2);

      const paymentsOfE = await paymentRepository.findAllBy(openScope(), {
        condominiumId: ctx.seed.condominiumId,
      });
      const relatedPayments = paymentsOfE.filter((payment) =>
        chargesAfter.some((charge) => charge.id === payment.chargeId),
      );
      expect(relatedPayments.length).toBeGreaterThanOrEqual(1);
      expect(relatedPayments[0].amount).toBe(462);
    });

    it('IT-014 - POST execute concorrente: apenas um executa, o outro recebe 409', async () => {
      rmResidentF = await createDedicatedResident('Alvo Concorrente');
      const requestF = await createRequest(rmResidentF.id);

      const first = adminAgent.post(`/lgpd/delete-request/${requestF.id}/execute`);
      const second = adminAgent.post(`/lgpd/delete-request/${requestF.id}/execute`);
      const results = await Promise.allSettled([first, second]);

      const codes = results.map((result) =>
        result.status === 'fulfilled' ? result.value.status : -1,
      );
      expect(codes).toContain(200);
      expect(codes).toContain(409);
    });

    it('IT-015 - POST execute como RESIDENT retorna 403 Forbidden', async () => {
      const response = await moradorAgent.post(`/lgpd/delete-request/${requestForA.id}/execute`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('IT-016 - GET /lgpd/delete-requests lista pedidos com seus status', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();
      rmResidentR = await createDedicatedResident('Alvo Listagem');
      const pendingR = await createRequest(rmResidentR.id, 'PENDING');
      const executedR = await createRequest(rmResidentR.id, 'EXECUTED');
      const cancelledR = await createRequest(rmResidentR.id, 'CANCELLED');

      const response = await adminAgent.get('/lgpd/delete-requests');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      const byId = new Map<string, { id: string; status: string }>(
        response.body.data.map((request: { id: string; status: string }) => [request.id, request]),
      );
      expect(byId.get(pendingR.id)?.status).toBe('PENDING');
      expect(byId.get(executedR.id)?.status).toBe('EXECUTED');
      expect(byId.get(cancelledR.id)?.status).toBe('CANCELLED');
    });

    it('IT-017 - GET /lgpd/delete-requests sem registros retorna lista vazia', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();

      const response = await adminAgent.get('/lgpd/delete-requests');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('IT-018 - GET /lgpd/delete-requests com filtro de condominio retorna somente o escopo', async () => {
      await createRequest(rmResidentR.id, 'PENDING', ctx.seed.condominiumId);
      await createRequest(rmResidentR.id, 'CANCELLED', ctx.seed.condominiumId);
      await createRequest(rmResidentR.id, 'PENDING', condo2Id);

      const response = await adminAgent.get(
        `/lgpd/delete-requests?condominiumId=${ctx.seed.condominiumId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(
        response.body.data.every(
          (request: { condominiumId: string }) => request.condominiumId === ctx.seed.condominiumId,
        ),
      ).toBe(true);
    });

    it('IT-019 - GET /lgpd/delete-requests/:id de pedido executado mostra "Anonimizado"', async () => {
      const executedForA = await createRequest(rmResidentA.id, 'EXECUTED');

      const response = await adminAgent.get(`/lgpd/delete-requests/${executedForA.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('EXECUTED');
      expect(response.body.data.residentName).toBe('Anonimizado');
    });

    it('IT-020 - POST /lgpd/delete-request/:id/cancel de pedido pendente retorna CANCELLED', async () => {
      const pendingMorador = await createRequest(moradorResidentId, 'PENDING');

      const response = await moradorAgent.post(`/lgpd/delete-request/${pendingMorador.id}/cancel`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('IT-021 - POST cancel de pedido executado retorna 409', async () => {
      const executedMorador = await createRequest(moradorResidentId, 'EXECUTED');

      const response = await moradorAgent.post(`/lgpd/delete-request/${executedMorador.id}/cancel`);

      expect(response.status).toBe(409);
    });

    it('IT-022 - POST cancel de pedido ja cancelado retorna 409', async () => {
      const cancelledMorador = await createRequest(moradorResidentId, 'CANCELLED');

      const response = await moradorAgent.post(
        `/lgpd/delete-request/${cancelledMorador.id}/cancel`,
      );

      expect(response.status).toBe(409);
    });

    it('IT-023 - POST cancel com falha de rede propaga o erro (500)', async () => {
      const pendingMorador = await createRequest(moradorResidentId, 'PENDING');
      jest
        .spyOn(lgpdRequestRepository, 'update')
        .mockRejectedValueOnce(new Error('falha de rede no cancelamento'));

      const response = await moradorAgent.post(`/lgpd/delete-request/${pendingMorador.id}/cancel`);

      expect(response.status).toBe(500);
    });
  });

  describe('Consent management (IT-041..048)', () => {
    it('IT-041 - GET /lgpd/consent com consentimento existente retorna registro (200)', async () => {
      await AppDataSource.getRepository(LgpdConsent).delete({ residentId: moradorResidentId });
      await lgpdConsentRepository.create(openScope(), {
        residentId: moradorResidentId,
        consentType: 'DATA_PROCESSING',
        granted: true,
        grantedAt: new Date(),
        revokedAt: null,
      });

      const response = await moradorAgent.get('/lgpd/consent');

      expect(response.status).toBe(200);
      expect(response.body.data.granted).toBe(true);
      expect(response.body.data.grantedAt).toBeTruthy();
      expect(response.body.data.consentType).toBe('DATA_PROCESSING');
    });

    it('IT-042 - GET /lgpd/consent sem registro usa o marco de registro do morador', async () => {
      await AppDataSource.getRepository(LgpdConsent).delete({ residentId: moradorResidentId });
      const registrationDate = new Date('2026-01-15T10:00:00.000Z');
      await residentRepository.update(openScope(), moradorResidentId, {
        lgpdConsentAt: registrationDate,
      });

      const response = await moradorAgent.get('/lgpd/consent');

      expect(response.status).toBe(200);
      expect(response.body.data.granted).toBe(true);
      expect(new Date(response.body.data.grantedAt).getTime()).toBe(registrationDate.getTime());
    });

    it('IT-043 - GET /lgpd/consent sem registro e sem marco retorna granted false', async () => {
      await AppDataSource.getRepository(LgpdConsent).delete({ residentId: moradorResidentId });
      await residentRepository.update(openScope(), moradorResidentId, {
        lgpdConsentAt: null,
      });

      const response = await moradorAgent.get('/lgpd/consent');

      expect(response.status).toBe(200);
      expect(response.body.data.granted).toBe(false);
      expect(response.body.data.grantedAt).toBeNull();
      expect(response.body.data.revokedAt).toBeNull();
    });

    it('IT-044 - POST /lgpd/consent { granted: false } revoga e registra revokedAt', async () => {
      const response = await moradorAgent.post('/lgpd/consent').send({ granted: false });

      expect(response.status).toBe(200);
      expect(response.body.data.granted).toBe(false);
      expect(response.body.data.revokedAt).toBeTruthy();
    });

    it('IT-045 - POST /lgpd/consent com reservas ativas retorna aviso de reserva', async () => {
      const response = await moradorAgent.post('/lgpd/consent').send({ granted: false });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.warnings)).toBe(true);
      expect(
        response.body.data.warnings.some((warning: string) => warning.includes('reserva')),
      ).toBe(true);
    });

    it('IT-046 - POST /lgpd/consent com cobrancas pendentes retorna aviso de cobranca', async () => {
      const response = await moradorAgent.post('/lgpd/consent').send({ granted: false });

      expect(response.status).toBe(200);
      expect(
        response.body.data.warnings.some((warning: string) => warning.includes('cobranca')),
      ).toBe(true);
    });

    it('IT-047 - POST /lgpd/consent com falha de rede propaga o erro (500)', async () => {
      jest
        .spyOn(lgpdConsentRepository, 'update')
        .mockRejectedValueOnce(new Error('falha de rede no consentimento'));
      const response = await moradorAgent.post('/lgpd/consent').send({ granted: false });

      expect(response.status).toBe(500);
    });

    it('IT-048 - POST /lgpd/consent registra trilha de auditoria LGPD_CONSENT_GRANTED', async () => {
      const response = await moradorAgent.post('/lgpd/consent').send({ granted: true });

      expect(response.status).toBe(200);
      expect(response.body.data.granted).toBe(true);

      const trail = await auditRepository.findAllBy(openScope(), {
        action: 'LGPD_CONSENT_GRANTED',
        resourceId: moradorResidentId,
      });
      expect(trail.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Data export (IT-025..040)', () => {
    it('IT-025 - GET /lgpd/export gera payload valido com todas as secoes', async () => {
      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      const parse = lgpdExportPayloadSchema.safeParse(response.body.data);
      expect(parse.success).toBe(true);
      const payload = response.body.data;
      expect(Array.isArray(payload.dependents)).toBe(true);
      expect(Array.isArray(payload.vehicles)).toBe(true);
      expect(Array.isArray(payload.reservations)).toBe(true);
      expect(Array.isArray(payload.financial.charges)).toBe(true);
      expect(Array.isArray(payload.financial.payments)).toBe(true);
      expect(Array.isArray(payload.correspondences)).toBe(true);
      expect(Array.isArray(payload.documents)).toBe(true);
      expect(payload.dataSubject.name).toBeTruthy();
    });

    it('IT-026 - GET /lgpd/export de morador sem dependentes retorna array vazio', async () => {
      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      expect(response.body.data.dependents).toHaveLength(0);
    });

    it('IT-037 - GET /lgpd/export de morador completo preenche todas as secoes', async () => {
      await addDependent(moradorResident, 950);

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      const payload = response.body.data;
      expect(payload.dependents).toHaveLength(1);
      expect(payload.vehicles).toHaveLength(1);
      expect(payload.reservations.length).toBeGreaterThanOrEqual(1);
      expect(payload.financial.charges.length).toBeGreaterThanOrEqual(3);
      expect(payload.financial.payments.length).toBeGreaterThanOrEqual(1);
      expect(payload.correspondences.length).toBeGreaterThanOrEqual(1);
      expect(payload.documents.length).toBeGreaterThanOrEqual(2);
    });

    it('IT-040 - GET /lgpd/export aninha pagamentos dentro das cobrancas', async () => {
      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      const payload = response.body.data;
      const paidCharge = payload.financial.charges.find(
        (charge: { status: string }) => charge.status === 'PAID',
      );
      expect(paidCharge).toBeDefined();
      expect(paidCharge.payments.length).toBeGreaterThanOrEqual(1);
      const nestedPaymentIds = paidCharge.payments.map((payment: { id: string }) => payment.id);
      expect(
        payload.financial.payments.some((payment: { id: string }) =>
          nestedPaymentIds.includes(payment.id),
        ),
      ).toBe(true);
    });

    it('IT-033 - GET /lgpd/export/:residentId como admin retorna os dados do morador', async () => {
      const response = await adminAgent.get(`/lgpd/export/${moradorResidentId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.resident.id).toBe(moradorResidentId);
    });

    it('IT-036 - GET /lgpd/export/:residentId como SINDICO do mesmo condominio retorna 200', async () => {
      const response = await sindicoAgent.get(`/lgpd/export/${moradorResidentId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.dataSubject.name).toBe(moradorResident.name);
    });

    it('IT-027 - GET /lgpd/export de morador sem veiculo retorna array vazio', async () => {
      await vehicleRepository.softDelete(openScope(), moradorVehicleId);

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toHaveLength(0);
    });

    it('IT-028 - GET /lgpd/export de morador sem dados financeiros retorna listas vazias', async () => {
      const chargesOfMorador = await chargeRepository.findAllBy(openScope(), {
        unitId: moradorUnitId,
      });
      for (const charge of chargesOfMorador) {
        await chargeRepository.softDelete(openScope(), charge.id);
      }

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      expect(response.body.data.financial.charges).toHaveLength(0);
      expect(response.body.data.financial.payments).toHaveLength(0);
    });

    it('IT-029 - GET /lgpd/export inclui metadados dos documentos sem o conteudo', async () => {
      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      const documents = response.body.data.documents;
      expect(documents.length).toBeGreaterThanOrEqual(2);
      for (const document of documents) {
        expect(document.title).toBeTruthy();
        expect(document).not.toHaveProperty('filePath');
      }
    });

    it('IT-032 - GET /lgpd/export com mais de 100 cobrancas gera payload completo', async () => {
      for (let index = 0; index < 105; index += 1) {
        await addCharge(moradorResident, 1000 + index, 'PENDING');
      }

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      expect(response.body.data.financial.charges.length).toBeGreaterThanOrEqual(100);
    });

    it('IT-034 - GET /lgpd/export/:residentId de outro condominio retorna 403', async () => {
      const response = await sindicoAgent.get(`/lgpd/export/${condo2Resident.id}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('IT-035 - GET /lgpd/export/:residentId de morador anonimizado retorna dados minimos', async () => {
      const response = await adminAgent.get(`/lgpd/export/${rmResidentA.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.dataSubject.name).toBe('Anonimizado');
      expect(response.body.data.dataSubject.email).toBeNull();
      expect(response.body.data.dependents).toHaveLength(0);
      expect(response.body.data.vehicles).toHaveLength(0);
      expect(response.body.data.reservations).toHaveLength(0);
      expect(response.body.data.financial.charges).toHaveLength(0);
    });

    it('IT-038 - GET /lgpd/export de morador do segundo condominio traz apenas dados do escopo', async () => {
      const response = await adminAgent.get(`/lgpd/export/${condo2Resident.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.resident.condominiumId).toBe(condo2Id);
      expect(response.body.data.documents).toHaveLength(0);
      expect(response.body.data.dependents).toHaveLength(0);
      expect(response.body.data.vehicles).toHaveLength(0);
      const charges = response.body.data.financial.charges;
      expect(charges.length).toBeGreaterThanOrEqual(1);
      expect(
        charges.every((charge: { condominiumId: string }) => charge.condominiumId === condo2Id),
      ).toBe(true);
    });

    it('IT-039 - GET /lgpd/export exclui registros com soft delete', async () => {
      const moradorCharges = await chargeRepository.findAllBy(openScope(), {
        unitId: moradorUnitId,
      });
      const deletedIds: string[] = [];
      for (const charge of moradorCharges.slice(0, 2)) {
        await chargeRepository.softDelete(openScope(), charge.id);
        deletedIds.push(charge.id);
      }

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(200);
      expect(response.body.data.vehicles).toHaveLength(0);
      const exportedIds = response.body.data.financial.charges.map(
        (charge: { id: string }) => charge.id,
      );
      expect(exportedIds).not.toContain(deletedIds[0]);
      expect(exportedIds).not.toContain(deletedIds[1]);
    });

    it('IT-030 - GET /lgpd/export com falha de rede propaga o erro (500)', async () => {
      jest
        .spyOn(residentRepository, 'findOneBy')
        .mockRejectedValueOnce(new Error('falha de rede na exportacao'));

      const response = await moradorAgent.get('/lgpd/export');

      expect(response.status).toBe(500);
    });

    it('IT-031 - GET /lgpd/export de morador anonimizado apos execucao retorna dados minimos', async () => {
      await AppDataSource.getRepository(LgpdRequest).clear();
      const moradorRequest = await createRequest(moradorResidentId, 'PENDING');

      const execute = await adminAgent.post(`/lgpd/delete-request/${moradorRequest.id}/execute`);

      expect(execute.status).toBe(200);
      expect(execute.body.data.residentsAnonymized).toBe(1);
      expect(execute.body.data.dependentsAnonymized).toBe(1);

      const anonymizedMorador = (await residentRepository.findOneBy(openScope(), {
        id: moradorResidentId,
      })) as Resident;
      expect(anonymizedMorador.name).toMatch(/^REDACTED-/);
      expect(anonymizedMorador.document).toBe('000.000.000-00');
      expect(anonymizedMorador.userId).toBeNull();

      const response = await adminAgent.get(`/lgpd/export/${moradorResidentId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.dataSubject.name).toBe('Anonimizado');
      expect(response.body.data.vehicles).toHaveLength(0);
      expect(response.body.data.financial.charges).toHaveLength(0);
      expect(response.body.data.documents).toHaveLength(0);
    });
  });

  describe('Configuracao do encarregado (IT-053)', () => {
    const lgpdSettingsUrl = (): string => `/tenants/${ctx.seed.tenantId}/lgpd-settings`;
    const otherTenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('IT-053 - PUT /tenants/:id/lgpd-settings grava encarregado e retencao', async () => {
      const response = await adminAgent
        .put(lgpdSettingsUrl())
        .send({ dpoName: 'Maria Encarregada', dpoEmail: 'dpo@exemplo.com.br', retentionYears: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.lgpd).toMatchObject({
        dpoName: 'Maria Encarregada',
        dpoEmail: 'dpo@exemplo.com.br',
        retentionYears: 5,
      });
    });

    it('IT-053.E1 - email invalido do encarregado e recusado pelo contrato', async () => {
      const response = await adminAgent
        .put(lgpdSettingsUrl())
        .send({ dpoName: 'Maria Encarregada', dpoEmail: 'nao-e-um-email' });

      expect(response.status).toBe(422);
    });

    it('IT-053.E2 - um administrador nao altera a politica de outro tenant', async () => {
      const response = await adminAgent
        .put(`/tenants/${otherTenantId}/lgpd-settings`)
        .send({ dpoName: 'Fora do escopo' });

      expect(response.status).toBe(403);
    });

    it('IT-053.E3 - um morador nao configura a politica', async () => {
      const response = await moradorAgent
        .put(lgpdSettingsUrl())
        .send({ dpoName: 'Intruso', retentionYears: 1 });

      expect(response.status).toBe(403);
    });
  });
});
