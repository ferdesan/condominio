import { Copy, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Role } from '@/types/role';

export interface RoleRowActionsProps {
  role: Role;
  /** Editar e restaurar exigem `role:update` (ADR-006). */
  canUpdate: boolean;
  /** Duplicar **cadastra** um papel novo, entao pede `role:create` — nao `update`. */
  canCreate: boolean;
  canDelete: boolean;
  /** Recusa do servidor para esta linha. Fica onde a acao foi disparada. */
  error?: string;
  onViewPermissions: (role: Role) => void;
  onEdit: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onDelete: (role: Role) => void;
  onRestore: (role: Role) => void;
}

/**
 * Acoes na propria linha (ADR-003).
 *
 * **Ver permissoes nao e gatilhada por permissao de escrita**: e leitura, e quem
 * alcanca a tela ja tem `role:read`. E a unica acao que todo mundo ve.
 *
 * **Excluir nao aparece em papel do sistema.** `roleService.beforeRemove` o
 * recusa sempre, com 409 — oferecer o botao seria oferecer uma recusa. Editar
 * continua aparecendo porque a descricao ainda pode mudar; o dialogo explica o
 * que esta travado.
 *
 * Cada rotulo acessivel carrega o nome do papel: numa tabela de varias linhas,
 * "Editar" sozinho nao diz o quê.
 */
export function RoleRowActions({
  role,
  canUpdate,
  canCreate,
  canDelete,
  error,
  onViewPermissions,
  onEdit,
  onDuplicate,
  onDelete,
  onRestore,
}: RoleRowActionsProps) {
  const label = role.name;

  if (role.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction icon={RotateCcw} label={`Restaurar ${label}`} onClick={() => onRestore(role)} />
      </RowActions>
    );
  }

  return (
    <div className="space-y-1">
      <RowActions>
        <RowAction
          icon={ShieldCheck}
          label={`Ver permissões de ${label}`}
          onClick={() => onViewPermissions(role)}
        />

        {canUpdate ? (
          <RowAction icon={Pencil} label={`Editar ${label}`} onClick={() => onEdit(role)} />
        ) : null}

        {/*
          Duplicar aparece em **todo** papel, e nao so no do sistema. No do
          sistema ele e a unica saida — as permissoes de um semeado nao mudam —,
          mas partir de um personalizado parecido poupa a mesma matriz de cento e
          quarenta e cinco caixas.
        */}
        {canCreate ? (
          <RowAction icon={Copy} label={`Duplicar ${label}`} onClick={() => onDuplicate(role)} />
        ) : null}

        {canDelete && !role.isSystem ? (
          <RowAction
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${label}`}
            onClick={() => onDelete(role)}
          />
        ) : null}
      </RowActions>

      {/*
        A recusa aparece na linha, e não em toast: e sobre este papel, e a
        próxima coisa a fazer esta a dois centimetros dela. O caso mais comum e
        "existem N usuário(s) com este papel", que se resolve na tela de
        Usuários — e a mensagem do servidor já diz isso.
      */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
