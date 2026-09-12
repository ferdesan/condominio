import {
  hasPermission,
  manageAll,
  PERMISSION_CATALOG,
  readOnly,
} from '@/shared/constants/permissions';
import { findRoleDefinition, ROLE_DEFINITIONS } from '@/shared/constants/roles';

describe('Catalogo de permissoes', () => {
  it('gera uma permissao para cada par recurso/acao', () => {
    expect(PERMISSION_CATALOG).toContain('unit:read');
    expect(PERMISSION_CATALOG).toContain('charge:manage');
    expect(new Set(PERMISSION_CATALOG).size).toBe(PERMISSION_CATALOG.length);
  });

  it('reconhece a permissao exata', () => {
    expect(hasPermission(['unit:read'], 'unit:read')).toBe(true);
    expect(hasPermission(['unit:read'], 'unit:create')).toBe(false);
  });

  it('trata `manage` como curinga do recurso', () => {
    expect(hasPermission(['unit:manage'], 'unit:delete')).toBe(true);
    expect(hasPermission(['unit:manage'], 'charge:delete')).toBe(false);
  });

  it('trata `*` como acesso irrestrito', () => {
    expect(hasPermission(['*'], 'tenant:delete')).toBe(true);
  });

  it('nega quando nao ha permissao alguma', () => {
    expect(hasPermission([], 'unit:read')).toBe(false);
  });

  it('monta conjuntos auxiliares de permissoes', () => {
    expect(manageAll('unit')).toEqual([
      'unit:create',
      'unit:read',
      'unit:update',
      'unit:delete',
      'unit:manage',
    ]);
    expect(readOnly('unit', 'block')).toEqual(['unit:read', 'block:read']);
  });
});

describe('Matriz de papeis do sistema', () => {
  it('define os cinco papeis padrao', () => {
    expect(ROLE_DEFINITIONS).toHaveLength(5);
    expect(findRoleDefinition('ADMIN')).toBeDefined();
    expect(findRoleDefinition('INEXISTENTE')).toBeUndefined();
  });

  it('SUPER_ADMIN tem acesso irrestrito', () => {
    const role = findRoleDefinition('SUPER_ADMIN')!;
    expect(hasPermission(role.permissions, 'tenant:delete')).toBe(true);
  });

  it('SINDICO administra a operacao mas nao gerencia papeis nem tenants', () => {
    const role = findRoleDefinition('SINDICO')!;
    expect(hasPermission(role.permissions, 'charge:create')).toBe(true);
    expect(hasPermission(role.permissions, 'reservation:manage')).toBe(true);
    expect(hasPermission(role.permissions, 'role:create')).toBe(false);
    expect(hasPermission(role.permissions, 'tenant:delete')).toBe(false);
  });

  it('STAFF cuida da portaria sem tocar no financeiro', () => {
    const role = findRoleDefinition('STAFF')!;
    expect(hasPermission(role.permissions, 'visitor:create')).toBe(true);
    expect(hasPermission(role.permissions, 'correspondence:update')).toBe(true);
    expect(hasPermission(role.permissions, 'charge:create')).toBe(false);
    expect(hasPermission(role.permissions, 'user:read')).toBe(false);
  });

  it('RESIDENT faz autoatendimento sem acesso administrativo', () => {
    const role = findRoleDefinition('RESIDENT')!;
    expect(hasPermission(role.permissions, 'reservation:create')).toBe(true);
    expect(hasPermission(role.permissions, 'incident:create')).toBe(true);
    expect(hasPermission(role.permissions, 'charge:read')).toBe(true);
    expect(hasPermission(role.permissions, 'charge:create')).toBe(false);
    expect(hasPermission(role.permissions, 'user:read')).toBe(false);
    expect(hasPermission(role.permissions, 'unit:delete')).toBe(false);
  });
});
