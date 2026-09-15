/**
 * Espelha `backend/src/modules/roles/role.entity.ts`.
 *
 * **Morava em `types/user.ts` e mudou de casa.** `Role` nao e um tipo de
 * usuario: e um recurso proprio, com rotas proprias, que `User` apenas
 * referencia. A regra do cabecalho de `api.ts` — recurso novo ganha
 * `types/<recurso>.ts` — vale aqui, e a mudanca foi feita em vez de duplicar o
 * tipo: uma barrica criaria dois caminhos de import validos para o mesmo
 * simbolo. `types/user.ts` passa a importar daqui.
 *
 * **Os cinco papeis do sistema sao quase imutaveis.** `isSystem` marca os
 * semeados por tenant, e `roleService` recusa tres coisas sobre eles: renomear,
 * alterar permissoes e remover. Sobra a descricao — e so ela.
 */

export type Role = {
  id: string;
  /** O servidor grava em MAIUSCULAS, sempre: `beforeCreate` e `beforeUpdate` aplicam `toUpperCase()`. */
  name: string;
  description: string | null;
  /**
   * Permissoes concedidas, na forma `recurso:acao`.
   *
   * Duas resolvem outras: `*` libera tudo, e `<recurso>:manage` libera as
   * quatro acoes daquele recurso. `lib/permissions.ts` implementa a mesma
   * resolucao do servidor.
   */
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Resposta de `GET /roles/permissions`.
 *
 * Um **objeto**, e nao um array solto — `roleService.catalog()` devolve
 * `{ permissions: [...] }`. A lista traz `*` na frente e depois o produto de
 * `RESOURCES` por `ACTIONS`: hoje 29 recursos por 5 acoes, 145 entradas mais o
 * curinga.
 */
export type PermissionCatalog = {
  permissions: string[];
};
