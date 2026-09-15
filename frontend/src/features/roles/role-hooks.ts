/**
 * Camada de dados dos papeis de acesso.
 *
 * **Usa a fabrica do ADR-008**, ao contrario de perfil e administradora: aqui ha
 * um recurso de verdade, com as seis operacoes do roteador CRUD compartilhado e
 * `:id` em todas elas. O catalogo de permissoes e a excecao — uma leitura avulsa
 * que a fabrica nao conhece.
 *
 * **A chave e `roles`, a mesma familia de `useRoleOptions`** em
 * `features/users/user-hooks.ts`, que alimenta o seletor de papel da tela de
 * Usuarios com a chave `['roles', 'options']`. Isso e deliberado: a fabrica
 * invalida `[ROLES_KEY]` a cada mutacao, e o prefixo alcanca a chave do seletor
 * — criar um papel aqui faz a tela de Usuarios passar a oferece-lo, sem codigo
 * extra. O comentario de la protege a listagem de **usuarios**, que tem outra
 * chave e continua intocada.
 *
 * **Por tenant, e nao por condominio.** `RoleRepository` nao declara campo de
 * condominio e sua whitelist de filtros tem uma chave so: `isSystem`.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGet, type ApiError } from '@/lib/api';
import { createResourceHooks } from '@/lib/crud';
import type { PermissionCatalog, Role } from '@/types/role';
import type { RolePayload } from './role-schema';

export const ROLES_KEY = 'roles';

/**
 * Filtros aceitos por `RoleRepository` — **um so**.
 *
 * `pickFilters` descarta o resto antes que vire uma query inocua. Nao ha filtro
 * por permissao: o servidor guarda a lista como JSON e nao a indexa, entao um
 * controle desses seria descartado em silencio enquanto parecesse funcionar.
 */
export const roleFilters = ['isSystem'] as const;

/**
 * O servidor ordena por filtravel + buscavel + os dois timestamps
 * (`BaseRepository.applySorting`). Buscaveis: `name` e `description`.
 */
export const roleSortable = ['isSystem', 'name', 'description', 'createdAt', 'updatedAt'] as const;

export const roleHooks = createResourceHooks<Role, RolePayload, Partial<RolePayload>>(ROLES_KEY);

/**
 * O catalogo de permissoes do sistema, de `GET /roles/permissions`.
 *
 * **Vem do servidor, e nao de uma lista escrita aqui.** Uma copia local
 * divergiria no primeiro recurso novo do backend, e a divergencia apareceria
 * como uma permissao que o formulario oferece e o `z.enum` do servidor recusa.
 *
 * `staleTime: Infinity` porque o catalogo e constante em tempo de execucao: ele
 * e o produto de duas listas declaradas em `shared/constants/resources.ts`, e so
 * muda quando o servidor e reimplantado.
 *
 * O corpo e um objeto, `{ permissions }`, e nao um array solto.
 */
export function usePermissionCatalog(): UseQueryResult<string[], ApiError> {
  return useQuery<string[], ApiError>({
    queryKey: [ROLES_KEY, 'permissions'],
    queryFn: async () => {
      const result = await apiGet<PermissionCatalog>('/roles/permissions');
      return result.permissions;
    },
    staleTime: Infinity,
  });
}
