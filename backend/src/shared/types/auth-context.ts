export type AuthContext = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  /** Condominios aos quais o usuario esta vinculado; vazio = todos do tenant. */
  condominiumIds: string[];
  /** Unidade do morador, quando aplicavel. */
  unitId?: string | null;
  isSuperAdmin: boolean;
  sessionId: string;
};
