/**
 * Espelho cliente de `createRoleSchema`, em
 * `backend/src/modules/roles/role.schema.ts`.
 *
 * Duas coisas fogem da convencao dos demais formularios:
 *
 * - **`permissions` e uma lista, e nao texto.** Ela vai e volta como
 *   `string[]` porque e isso que o controle produz e o que o servidor aceita;
 *   converte-la para texto so para respeitar a convencao criaria uma
 *   serializacao sem leitor.
 * - **O nome e normalizado pelo servidor**, que aplica `trim().toUpperCase()`
 *   antes de gravar. O formulario nao o faz por conta propria: o valor exibido
 *   depois de salvar e o que o servidor devolveu, e nao um palpite do cliente.
 */

import { z } from 'zod';
import type { Role } from '@/types/role';

/** `WILDCARD_PERMISSION` de `lib/permissions.ts`, repetido aqui como valor de dado. */
export const WILDCARD = '*';

const roleFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Informe o nome do papel.')
    .max(60, 'Use no maximo 60 caracteres.')
    // Mesma expressao do servidor. Note que ela **nao** aceita acento: um nome
    // com cedilha seria recusado la, entao e recusado aqui, com a mensagem que
    // explica o que vale.
    .regex(/^[A-Za-z0-9_ -]+$/, 'Use apenas letras sem acento, numeros, espaco, hifen ou underscore.'),
  description: z.string().trim().max(255, 'Use no maximo 255 caracteres.'),
  permissions: z
    .array(z.string())
    .min(1, 'Selecione ao menos uma permissao.')
    .max(400, 'Selecao grande demais.'),
});

export const roleSchema = roleFields;
export type RoleFormValues = z.infer<typeof roleSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto. */
export const ROLE_FIELDS: ReadonlySet<string> = new Set(Object.keys(roleFields.shape));

export function roleFormDefaults(): RoleFormValues {
  return { name: '', description: '', permissions: [] };
}

export function toRoleFormValues(role: Role): RoleFormValues {
  return {
    name: role.name,
    description: role.description ?? '',
    permissions: [...role.permissions],
  };
}

export type RolePayload = {
  name: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar a descricao precisa apaga-la. */
  description: string | null;
  permissions: string[];
};

export function toRolePayload(values: RoleFormValues): RolePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() === '' ? null : values.description.trim(),
    permissions: values.permissions,
  };
}

/**
 * O corpo de edicao de um papel do sistema: **so a descricao**.
 *
 * `roleService.beforeUpdate` recusa com 409 tanto renomear quanto alterar as
 * permissoes de um papel semeado. Mandar `name` igual ao atual passaria — a
 * comparacao e contra o valor corrente —, mas mandar `permissions` iguais **nao**:
 * a guarda olha a presenca da chave, e nao o conteudo. Por isso a edicao de um
 * papel do sistema envia um corpo de um campo so.
 */
export function toSystemRolePayload(values: RoleFormValues): Partial<RolePayload> {
  return { description: values.description.trim() === '' ? null : values.description.trim() };
}

/**
 * Separa o curinga do resto.
 *
 * `roleService.catalog()` devolve `['*', ...]`, e a matriz e construida sobre
 * `recurso:acao` — o curinga nao tem recurso nem acao e nao cabe em nenhuma
 * celula. Ele e apresentado a parte, e so a quem pode concede-lo.
 */
export function splitCatalog(catalog: readonly string[]): {
  hasWildcard: boolean;
  byResource: Map<string, Set<string>>;
} {
  const byResource = new Map<string, Set<string>>();
  let hasWildcard = false;

  for (const entry of catalog) {
    if (entry === WILDCARD) {
      hasWildcard = true;
      continue;
    }
    const separator = entry.indexOf(':');
    if (separator < 1) continue;
    const resource = entry.slice(0, separator);
    const action = entry.slice(separator + 1);
    const actions = byResource.get(resource) ?? new Set<string>();
    actions.add(action);
    byResource.set(resource, actions);
  }

  return { hasWildcard, byResource };
}
