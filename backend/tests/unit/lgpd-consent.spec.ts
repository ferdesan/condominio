import { lgpdService } from '@/modules/lgpd/lgpd.service';
import { lgpdConsentRepository } from '@/modules/lgpd/lgpd-consent.repository';
import { residentRepository } from '@/modules/residents/resident.repository';
import { Resident } from '@/modules/residents/resident.entity';
import type { TenantScope } from '@/shared/repositories/types';
import type { RequestContext } from '@/shared/services/request-context';
import { setupTestContext, teardownTestContext, type TestContext } from '../helpers/test-context';

describe('LGPD - gestao de consentimento (UT-022..023)', () => {
  let ctx: TestContext;
  let scope: TenantScope;

  const moradorCtx = (): RequestContext => ({
    scope: { tenantId: ctx.seed.tenantId, condominiumIds: [ctx.seed.condominiumId] },
    actor: {
      userId: ctx.seed.users.morador.id,
      tenantId: ctx.seed.tenantId,
      email: ctx.seed.users.morador.email,
      name: 'Morador',
      roleId: '',
      roleName: 'RESIDENT',
      permissions: ['lgpd-consent:create', 'lgpd-consent:read', 'lgpd-request:create'],
      condominiumIds: [ctx.seed.condominiumId],
      unitId: null,
      isSuperAdmin: false,
      sessionId: 'sess-test',
    },
    ipAddress: '127.0.0.1',
  });

  beforeAll(async () => {
    ctx = await setupTestContext();
    scope = { tenantId: ctx.seed.tenantId, condominiumIds: [] };
    const morador = (await residentRepository.findOneBy(scope, {
      userId: ctx.seed.users.morador.id,
    })) as Resident;
    await lgpdConsentRepository
      .query(scope)
      .delete()
      .from('lgpd_consents')
      .where('resident_id = :id', { id: morador.id })
      .execute();
  });

  afterAll(teardownTestContext);

  it('UT-022 - revogacao com reservas ativas retorna aviso', async () => {
    const result = await lgpdService.updateConsent(moradorCtx(), {
      consentType: 'DATA_PROCESSING',
      granted: false,
    });

    expect(result.granted).toBe(false);
    expect(result.revokedAt).toBeInstanceOf(Date);
    expect(result.warnings.some((warning) => warning.toLowerCase().includes('reserva'))).toBe(true);
  });

  it('UT-023 - revogacao com cobrancas pendentes retorna aviso', async () => {
    const result = await lgpdService.updateConsent(moradorCtx(), {
      consentType: 'DATA_PROCESSING',
      granted: false,
    });

    expect(result.granted).toBe(false);
    expect(result.warnings.some((warning) => warning.toLowerCase().includes('cobranca'))).toBe(
      true,
    );
  });

  it('UT-022/023 - concessao reativa o consentimento sem avisos adicionais', async () => {
    const result = await lgpdService.updateConsent(moradorCtx(), {
      consentType: 'DATA_PROCESSING',
      granted: true,
      description: 'Autorizo o tratamento',
    });

    expect(result.granted).toBe(true);
    expect(result.revokedAt).toBeNull();
  });
});
