import { ACTIONS, RESOURCES, type Action, type Resource } from './resources';

export type Permission = `${Resource}:${Action}` | '*';

/** `resource:manage` implies every action over that resource; `*` implies everything. */
export const WILDCARD_PERMISSION: Permission = '*';

export const PERMISSION_CATALOG: Permission[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => `${resource}:${action}` as Permission),
);

export function permission(resource: Resource, action: Action): Permission {
  return `${resource}:${action}` as Permission;
}

/**
 * Grants `read` + `create` + `update` + `delete` + `manage` for the given resources.
 */
export function manageAll(...resources: Resource[]): Permission[] {
  return resources.flatMap((resource) => ACTIONS.map((action) => permission(resource, action)));
}

export function readOnly(...resources: Resource[]): Permission[] {
  return resources.map((resource) => permission(resource, 'read'));
}

/**
 * Resolves whether a set of granted permissions satisfies a required one,
 * honouring the `*` and `<resource>:manage` wildcards.
 */
export function hasPermission(granted: readonly string[], required: Permission): boolean {
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  if (granted.includes(required)) return true;
  const [resource] = required.split(':');
  return granted.includes(`${resource}:manage`);
}
