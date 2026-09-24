import { AppDataSource } from '@/config/data-source';
import { ROLE_DEFINITIONS, ROLE_SINDICO } from '@/shared/constants/roles';
import { SyncSystemRolePermissions1758200000000 } from '@/database/migrations/1758200000000-SyncSystemRolePermissions';
import {
  login,
  seedUsers,
  setupTestContext,
  teardownTestContext,
  type AuthenticatedAgent,
  type TestContext,
} from '../helpers/test-context';

describe('Sincronizacao de permissoes de papel do sistema', () => {
  let ctx: TestContext;
  let admin: AuthenticatedAgent;
  let customRoleId: string;

  beforeAll(async () => {
    ctx = await setupTestContext();
    admin = await login(ctx, seedUsers.admin);
  });

  afterAll(teardownTestContext);

  it('prepara uma base antiga (SINDICO sem role:read) e um papel personalizado', async () => {
    // O estado que gerou o 403 em `/usuarios`: papel semeado antes do commit
    // 71cb3ae, guardado assim porque `runSeeds` pula quando o tenant existe.
    const legacy = ['user:read', 'user:update', 'dashboard:read'];
    await AppDataSource.query('UPDATE roles SET permissions = ? WHERE is_system = 1 AND name = ?', [
      JSON.stringify(legacy),
      ROLE_SINDICO,
    ]);

    const [sindico] = await AppDataSource.query<{ permissions: string }[]>(
      'SELECT permissions FROM roles WHERE is_system = 1 AND name = ?',
      [ROLE_SINDICO],
    );
    expect(JSON.parse(sindico.permissions)).toEqual(legacy);

    const created = await admin.post('/roles').send({
      name: 'Papel Reparo',
      permissions: ['dashboard:read'],
    });
    expect(created.status).toBe(201);
    customRoleId = created.body.data.id;
  });

  it('restaura as permissoes do codigo sem tocar em papel personalizado', async () => {
    const migration = new SyncSystemRolePermissions1758200000000();
    const queryRunner = await AppDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await migration.up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    const definition = ROLE_DEFINITIONS.find((role) => role.name === ROLE_SINDICO);
    expect(definition).toBeDefined();

    const [sindico] = await AppDataSource.query<{ permissions: string }[]>(
      'SELECT permissions FROM roles WHERE is_system = 1 AND name = ?',
      [ROLE_SINDICO],
    );
    expect(JSON.parse(sindico.permissions)).toEqual(definition!.permissions);
    // A chave que faltava e a que a tela de usuarios precisa.
    expect(JSON.parse(sindico.permissions)).toContain('role:read');

    const [custom] = await AppDataSource.query<{ permissions: string }[]>(
      'SELECT permissions FROM roles WHERE id = ?',
      [customRoleId],
    );
    expect(JSON.parse(custom.permissions)).toEqual(['dashboard:read']);
  });

  it('roda de novo sem efeito colateral', async () => {
    const migration = new SyncSystemRolePermissions1758200000000();
    const queryRunner = await AppDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await migration.up(queryRunner);
      await migration.up(queryRunner);
    } finally {
      await queryRunner.release();
    }

    const definition = ROLE_DEFINITIONS.find((role) => role.name === ROLE_SINDICO);
    const [sindico] = await AppDataSource.query<{ permissions: string }[]>(
      'SELECT permissions FROM roles WHERE is_system = 1 AND name = ?',
      [ROLE_SINDICO],
    );
    expect(JSON.parse(sindico.permissions)).toEqual(definition!.permissions);
  });
});
