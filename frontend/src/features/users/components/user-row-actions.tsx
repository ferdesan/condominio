import { KeyRound, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { User } from '@/types/user';

export interface UserRowActionsProps {
  user: User;
  /** Editar e restaurar exigem `user:update` (ADR-006). */
  canUpdate: boolean;
  /**
   * Resetar senha exige **`user:manage`**, e nao `update` (ADR-002). Quem
   * corrige um telefone nao necessariamente pode derrubar as sessoes de outra
   * pessoa — e o servidor faz exatamente essa divisao em `user.routes.ts`.
   */
  canManage: boolean;
  canDelete: boolean;
  /** Recusa do servidor para esta linha. Fica onde a acao foi disparada. */
  error?: string;
  onResetPassword: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onRestore: (user: User) => void;
}

/**
 * Acoes de administracao na propria linha (ADR-003).
 *
 * Resetar senha nao olha o estado da conta para se oferecer: o servidor aceita o
 * reset em qualquer status — inclusive, e sobretudo, num usuario bloqueado, que
 * e justamente quando ele costuma ser preciso.
 *
 * Cada rotulo acessivel carrega o nome do usuario: numa tabela de vinte linhas,
 * "Resetar senha" sozinho nao diz de quem.
 */
export function UserRowActions({
  user,
  canUpdate,
  canManage,
  canDelete,
  error,
  onResetPassword,
  onEdit,
  onDelete,
  onRestore,
}: UserRowActionsProps) {
  const label = user.name;

  if (user.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction icon={RotateCcw} label={`Restaurar ${label}`} onClick={() => onRestore(user)} />
      </RowActions>
    );
  }

  return (
    <div className="space-y-1">
      <RowActions>
        {canManage ? (
          <RowAction
            icon={KeyRound}
            label={`Resetar senha de ${label}`}
            onClick={() => onResetPassword(user)}
          />
        ) : null}

        {canUpdate ? (
          <RowAction icon={Pencil} label={`Editar ${label}`} onClick={() => onEdit(user)} />
        ) : null}

        {canDelete ? (
          <RowAction
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${label}`}
            onClick={() => onDelete(user)}
          />
        ) : null}
      </RowActions>

      {/*
        A recusa aparece na linha, e não em toast: e sobre este usuário, e a
        próxima coisa a fazer esta a dois centimetros dela.
      */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
