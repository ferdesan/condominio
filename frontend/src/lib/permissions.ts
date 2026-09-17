/**
 * Mesma resolucao de permissoes do backend
 * (`backend/src/shared/constants/permissions.ts`): `*` libera tudo e
 * `<recurso>:manage` libera qualquer acao sobre aquele recurso. Manter as duas
 * pontas iguais evita menu mostrando o que a API vai negar.
 */
export const WILDCARD_PERMISSION = '*';

export function hasPermission(
  granted: readonly string[] | undefined | null,
  required?: string,
): boolean {
  if (!granted) return false;
  if (!required) return true;
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  if (granted.includes(required)) return true;
  const [resource] = required.split(':');
  return granted.includes(`${resource}:manage`);
}

export function hasAnyPermission(
  granted: readonly string[] | undefined | null,
  required: readonly string[],
): boolean {
  return required.length === 0 || required.some((item) => hasPermission(granted, item));
}
