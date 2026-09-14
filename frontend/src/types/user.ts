/**
 * Espelha `backend/src/modules/users/user.entity.ts` e o contrato de
 * `user.schema.ts`, mais o papel de `role.entity.ts`.
 *
 * Arquivo proprio pelo mesmo motivo de `incident.ts`: `api.ts` e compartilhado
 * entre as tasks deste tier e ja foi ponto de quebra.
 *
 * **Este recurso nao e escopado por condominio.** `UserRepository` nao declara
 * `condominiumField` e sua whitelist de filtros e `status`, `roleId` e `unitId`
 * — sem `condominiumId`. O vinculo com condominios vem embutido na resposta
 * (`relations: ['role', 'condominiums']`), e nunca como filtro.
 */

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Papel de acesso, de `GET /roles`.
 *
 * Os cinco papeis do sistema (`isSystem`) sao semeados por tenant e nao podem
 * ser removidos; um tenant pode criar outros combinando permissoes do catalogo.
 */
export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Condominio vinculado a um usuario, como vem aninhado na resposta de `/users`. */
export type UserCondominium = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** CPF, somente digitos: o servidor guarda `varchar(11)` ja normalizado. */
  document: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  roleId: string;
  /** Presente: `UserRepository` faz eager load do papel. */
  role?: Role | null;
  /**
   * Condominios visiveis para o usuario.
   *
   * **Lista vazia significa "todos do tenant"**, e nao "nenhum": e como perfis
   * administrativos sao cadastrados, e e a leitura que o proprio servidor faz
   * em `recipientsService.usersOfCondominium`.
   */
  condominiums?: UserCondominium[] | null;
  /** Unidade vinculada quando o usuario e morador. */
  unitId: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Resposta de `POST /users/:id/reset-password`.
 *
 * A senha temporaria so vem quando o administrador nao informou uma — e vem uma
 * unica vez, porque o servidor guarda apenas o hash. Ela nao e recuperavel
 * depois, e e por isso que a tela a mostra em vez de descartar.
 */
export type PasswordReset = {
  temporaryPassword?: string;
};
