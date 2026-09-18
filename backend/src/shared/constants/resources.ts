/** Canonical list of protected resources. Used to build the permission catalog. */
export const RESOURCES = [
  'tenant',
  'user',
  'role',
  'condominium',
  'block',
  'unit',
  'resident',
  'dependent',
  'employee',
  'visitor',
  'service-provider',
  'vehicle',
  'correspondence',
  'common-area',
  'reservation',
  'financial-category',
  'charge',
  'payment',
  'expense',
  'financial-closing',
  'assembly',
  'poll',
  'vote',
  'announcement',
  'incident',
  'maintenance',
  'document',
  'dashboard',
  'audit-log',
  'notification',
  'lgpd-request',
  'lgpd-consent',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;
export type Action = (typeof ACTIONS)[number];
