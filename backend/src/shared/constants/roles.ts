import { manageAll, readOnly, WILDCARD_PERMISSION, type Permission } from './permissions';
import { RESOURCES } from './resources';

export const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
export const ROLE_ADMIN = 'ADMIN';
export const ROLE_SINDICO = 'SINDICO';
export const ROLE_STAFF = 'STAFF';
export const ROLE_RESIDENT = 'RESIDENT';

export const SYSTEM_ROLES = [
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_SINDICO,
  ROLE_STAFF,
  ROLE_RESIDENT,
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export type RoleDefinition = {
  name: SystemRole;
  description: string;
  permissions: Permission[];
};

const OPERATIONAL_RESOURCES = RESOURCES.filter(
  (resource) =>
    resource !== 'tenant' &&
    resource !== 'role' &&
    resource !== 'audit-log' &&
    resource !== 'lgpd-request' &&
    resource !== 'lgpd-consent',
);

/**
 * Default permission matrix seeded for every tenant. Tenants may create
 * additional custom roles; these five are the immutable system baseline.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: ROLE_SUPER_ADMIN,
    description: 'Operador da plataforma: acesso irrestrito a todos os tenants.',
    permissions: [WILDCARD_PERMISSION],
  },
  {
    name: ROLE_ADMIN,
    description: 'Administradora do condominio: acesso total dentro do proprio tenant.',
    permissions: [
      ...manageAll(...RESOURCES.filter((resource) => resource !== 'tenant')),
      'tenant:read',
      'tenant:update',
    ],
  },
  {
    name: ROLE_SINDICO,
    description: 'Sindico: gestao operacional e financeira do condominio.',
    permissions: [
      ...manageAll(...OPERATIONAL_RESOURCES),
      ...readOnly('user', 'audit-log', 'tenant'),
      ...manageAll('lgpd-request'),
      'lgpd-consent:read',
    ],
  },
  {
    name: ROLE_STAFF,
    description: 'Funcionario/portaria: rotina de acesso, correspondencias e ocorrencias.',
    permissions: [
      ...manageAll('visitor', 'correspondence', 'vehicle', 'incident'),
      ...readOnly(
        'condominium',
        'block',
        'unit',
        'resident',
        'dependent',
        'employee',
        'service-provider',
        'common-area',
        'reservation',
        'announcement',
        'maintenance',
        'document',
        'dashboard',
        'notification',
        'lgpd-request',
        'lgpd-consent',
      ),
      'reservation:update',
      'maintenance:update',
      'notification:update',
    ],
  },
  {
    name: ROLE_RESIDENT,
    description: 'Morador: autoatendimento da propria unidade.',
    permissions: [
      ...readOnly(
        'condominium',
        'block',
        'unit',
        'resident',
        'dependent',
        'common-area',
        'announcement',
        'document',
        'charge',
        'payment',
        'assembly',
        'poll',
        'vehicle',
        'correspondence',
        'incident',
        'reservation',
        'visitor',
        'notification',
        'dashboard',
      ),
      'reservation:create',
      'reservation:update',
      'reservation:delete',
      'incident:create',
      'incident:update',
      'visitor:create',
      'vote:create',
      'vote:read',
      'dependent:create',
      'dependent:update',
      'vehicle:create',
      'vehicle:update',
      'notification:update',
      'lgpd-request:create',
      'lgpd-consent:read',
      'lgpd-consent:create',
    ],
  },
];

export function findRoleDefinition(name: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((role) => role.name === name);
}
