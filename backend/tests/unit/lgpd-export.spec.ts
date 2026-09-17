import { anonymizePersonalData } from '@/modules/lgpd/anonymize';
import { lgpdService } from '@/modules/lgpd/lgpd.service';
import { lgpdExportPayloadSchema } from '@/modules/lgpd/lgpd.schema';
import { chargeRepository } from '@/modules/financial/repositories/charge.repository';
import { paymentRepository } from '@/modules/financial/repositories/payment.repository';
import { commonAreaRepository } from '@/modules/common-areas/common-area.repository';
import { correspondenceRepository } from '@/modules/correspondences/correspondence.repository';
import { dependentRepository } from '@/modules/dependents/dependent.repository';
import { documentRepository } from '@/modules/documents/document.repository';
import { reservationRepository } from '@/modules/reservations/reservation.repository';
import { residentRepository } from '@/modules/residents/resident.repository';
import { vehicleRepository } from '@/modules/vehicles/vehicle.repository';
import { unitRepository } from '@/modules/units/unit.repository';
import { blockRepository } from '@/modules/blocks/block.repository';
import { Resident } from '@/modules/residents/resident.entity';
import type { TenantScope } from '@/shared/repositories/types';
import type { RequestContext } from '@/shared/services/request-context';
import { setupTestContext, teardownTestContext, type TestContext } from '../helpers/test-context';

describe('LGPD - estrutura do payload e exportacao (UT-012..021)', () => {
  let ctx: TestContext;
  let scope: TenantScope;
  let unitIds: string[];
  let unitIndex = 0;
  let residentsIndex = 0;

  const openScope = (): TenantScope => ({
    tenantId: ctx.seed.tenantId,
    condominiumIds: [],
  });

  const adminCtx = (): RequestContext => ({
    scope: openScope(),
    actor: {
      userId: ctx.seed.users.admin.id,
      tenantId: ctx.seed.tenantId,
      email: ctx.seed.users.admin.email,
      name: 'Admin',
      roleId: '',
      roleName: 'ADMIN',
      permissions: ['lgpd-request:manage', 'lgpd-request:read'],
      condominiumIds: [],
      unitId: null,
      isSuperAdmin: false,
      sessionId: 'sess-test',
    },
    ipAddress: '127.0.0.1',
  });

  async function createResident(name: string): Promise<Resident> {
    residentsIndex += 1;
    const freshUnitId = unitIds[unitIndex % unitIds.length];
    unitIndex += 1;
    return (await residentRepository.create(openScope(), {
      condominiumId: ctx.seed.condominiumId,
      unitId: freshUnitId,
      name: `${name} ${residentsIndex}`,
      document: `2223334445${residentsIndex % 10}`,
      email: `lgpd-export${residentsIndex}@exemplo.com.br`,
      phone: '(11) 92000-0000',
      type: 'OWNER',
      status: 'ACTIVE',
      isPrimary: true,
    })) as Resident;
  }

  async function seedFullData(resident: Resident): Promise<void> {
    await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Dependente Export',
      relationship: 'CHILD',
    });
    await vehicleRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      plate: `EXPT${String(residentsIndex).padStart(4, '0')}`,
      brand: 'Volkswagen',
      model: 'Polo',
      color: 'Preto',
      type: 'CAR',
      year: 2022,
      status: 'ACTIVE',
    });
    const [area] = await commonAreaRepository.findAllBy(scope, {});
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await reservationRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      commonAreaId: area.id,
      unitId: resident.unitId,
      requestedById: 'user-sindico',
      requestedByName: 'Sindico',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
      status: 'CONFIRMED',
      guestsCount: 4,
    });
    await correspondenceRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      type: 'PACKAGE',
      status: 'DELIVERED',
      carrier: 'Correios',
      description: 'Encomenda',
      receivedAt: new Date(),
      receivedBy: 'Portaria',
    });
    await documentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      title: 'Contrato de locacao',
      category: 'OTHER',
      visibility: 'RESIDENTS',
      fileName: 'contrato.pdf',
      filePath: 'demo/contrato.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      uploadedById: ctx.seed.users.admin.id,
      tags: ['contrato'],
    });
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
          number: `8${String(31 + index)}`,
          type: 'APARTMENT',
          status: 'OCCUPIED',
          area: 74,
        }),
      );
    }
    unitIds = (await Promise.all(created)).map((unit) => unit.id);
  });

  afterAll(teardownTestContext);

  it('UT-012 - payload de exportacao contem todas as chaves de topo', async () => {
    const resident = await createResident('Completo');
    await seedFullData(resident);

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(Object.keys(payload).sort()).toEqual(
      [
        'exportDate',
        'platform',
        'dataSubject',
        'resident',
        'dependents',
        'vehicles',
        'reservations',
        'financial',
        'correspondences',
        'documents',
      ].sort(),
    );
    const parsed = lgpdExportPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('UT-013 - morador sem dependentes exporta array vazio', async () => {
    const resident = await createResident('SemDependentes');

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.dependents).toEqual([]);
  });

  it('UT-014 - morador sem veiculos exporta array vazio', async () => {
    const resident = await createResident('SemVeiculo');

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.vehicles).toEqual([]);
  });

  it('UT-015 - morador sem financeiro exporta arrays vazios', async () => {
    const resident = await createResident('SemFinanceiro');

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.financial.charges).toEqual([]);
    expect(payload.financial.payments).toEqual([]);
  });

  it('UT-016 - documentos exportam apenas metadados, sem conteudo', async () => {
    const resident = await createResident('ComDocumento');
    await documentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      title: 'Regimento',
      category: 'REGULATION',
      visibility: 'RESIDENTS',
      fileName: 'regimento.pdf',
      filePath: 'demo/regimento.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 482_112,
      uploadedById: ctx.seed.users.admin.id,
    });

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    const myDoc = payload.documents.find((doc) => doc.fileName === 'regimento.pdf');
    expect(myDoc).toBeDefined();
    expect(myDoc?.fileName).toBe('regimento.pdf');
    expect(myDoc?.mimeType).toBe('application/pdf');
    expect(myDoc?.sizeBytes).toBe(482_112);
    expect(myDoc).not.toHaveProperty('filePath');
    expect(myDoc).not.toHaveProperty('fileContent');
    expect(myDoc).not.toHaveProperty('fileContentType');
  });

  it('UT-017 - morador anonimizado exporta dados minimos', async () => {
    const resident = await createResident('Anonimo');
    await seedFullData(resident);
    await anonymizePersonalData(scope, resident.id);

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.dataSubject.name).toBe('Anonimizado');
    expect(payload.dependents).toEqual([]);
    expect(payload.vehicles).toEqual([]);
    expect(payload.reservations).toEqual([]);
    expect(payload.financial.charges).toEqual([]);
    expect(payload.financial.payments).toEqual([]);
    expect(payload.correspondences).toEqual([]);
    expect(payload.documents).toEqual([]);
  });

  it('UT-018 - exportacao inclui todas as entidades nas secoes corretas', async () => {
    const resident = await createResident('Multi');
    await seedFullData(resident);
    await chargeRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      description: 'Taxa condominial',
      referenceMonth: '2026-08',
      dueDate: '2026-08-10',
      amount: 360,
      status: 'PENDING',
    });

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.resident.name).toBe(`Multi ${residentsIndex}`);
    expect(payload.dependents).toHaveLength(1);
    expect(payload.vehicles).toHaveLength(1);
    expect(payload.reservations).toHaveLength(1);
    expect(payload.correspondences.length).toBeGreaterThanOrEqual(1);
    expect(payload.documents.some((doc) => doc.fileName === 'contrato.pdf')).toBe(true);
    expect(payload.financial.charges.length).toBeGreaterThanOrEqual(1);
  });

  it('UT-019 - exportacao respeita o escopo do condominio do morador', async () => {
    const residentA = await createResident('EscopoA');
    const residentB = await createResident('EscopoB');
    await vehicleRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: residentA.unitId,
      residentId: residentA.id,
      plate: 'ESCOPOA1',
      brand: 'Fiat',
      model: 'Uno',
      color: 'Branco',
      type: 'CAR',
      year: 2019,
      status: 'ACTIVE',
    });
    await vehicleRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: residentB.unitId,
      residentId: residentB.id,
      plate: 'ESCOPOB1',
      brand: 'Honda',
      model: 'Civic',
      color: 'Azul',
      type: 'CAR',
      year: 2020,
      status: 'ACTIVE',
    });

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: residentA.id });

    expect(payload.vehicles).toHaveLength(1);
    expect(payload.vehicles[0].plate).toBe('ESCOPOA1');
    expect(payload.vehicles.map((vehicle) => vehicle.plate)).not.toContain('ESCOPOB1');
  });

  it('UT-020 - entidades soft-deleted sao excluidas da exportacao', async () => {
    const resident = await createResident('SoftDelete');
    const dependent = await dependentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      residentId: resident.id,
      name: 'Dependente Removido',
      relationship: 'CHILD',
    });
    const document = await documentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      title: 'Documento removido',
      category: 'OTHER',
      visibility: 'RESIDENTS',
      fileName: 'removido.pdf',
      filePath: 'demo/removido.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });

    await dependentRepository.softDelete(scope, dependent.id);
    await documentRepository.softDelete(scope, document.id);

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    expect(payload.dependents).toEqual([]);
    expect(payload.documents.map((doc) => doc.fileName)).not.toContain('removido.pdf');
  });

  it('UT-021 - cobranca exporta com pagamentos aninhados', async () => {
    const resident = await createResident('Parcela');
    const charge = await chargeRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      unitId: resident.unitId,
      description: 'Taxa condominial agosto',
      referenceMonth: '2026-08',
      dueDate: '2026-08-10',
      amount: 600,
      status: 'PAID',
      paidAmount: 600,
    });
    await paymentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      chargeId: charge.id,
      amount: 300,
      paidAt: new Date(),
      method: 'PIX',
    });
    await paymentRepository.create(scope, {
      condominiumId: ctx.seed.condominiumId,
      chargeId: charge.id,
      amount: 300,
      paidAt: new Date(),
      method: 'PIX',
    });

    const payload = await lgpdService.exportResidentData(adminCtx(), { residentId: resident.id });

    const exportedCharge = payload.financial.charges.find((item) => item.amount === 600) as Record<
      string,
      unknown
    > & { payments: unknown[] };
    expect(exportedCharge).toBeDefined();
    expect(exportedCharge.payments).toHaveLength(2);
    expect(payload.financial.payments).toHaveLength(2);
  });
});
