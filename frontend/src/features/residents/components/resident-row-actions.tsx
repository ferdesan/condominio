import { Pencil, RotateCcw, Trash2, UserCheck } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Resident } from '@/types/api';

export interface ResidentRowActionsProps {
  resident: Resident;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (resident: Resident) => void;
  onDelete: (resident: Resident) => void;
  onRestore: (resident: Resident) => void;
  onDesignatePrimary: (resident: Resident) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz quem sera editado.
 */
export function ResidentRowActions({
  resident,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
  onDesignatePrimary,
}: ResidentRowActionsProps) {
  if (resident.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${resident.name}`}
          onClick={() => onRestore(resident)}
        />
      </RowActions>
    );
  }

  // Um responsavel inativo e um contato que nao responde. A acao continua
  // visivel e desabilitada, com o motivo no titulo: escondendo-a, quem procura
  // por ela nao descobre por que sumiu (US-016.EC-5).
  const primaryBlocked = resident.status !== 'ACTIVE';

  return (
    <RowActions>
      {canUpdate && !resident.isPrimary ? (
        <RowAction
          icon={UserCheck}
          label={`Tornar ${resident.name} responsável pela unidade`}
          onClick={() => onDesignatePrimary(resident)}
          disabled={primaryBlocked}
        />
      ) : null}

      {canUpdate ? (
        <RowAction
          icon={Pencil}
          label={`Editar ${resident.name}`}
          onClick={() => onEdit(resident)}
        />
      ) : null}

      {canDelete ? (
        <RowAction
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${resident.name}`}
          onClick={() => onDelete(resident)}
        />
      ) : null}
    </RowActions>
  );
}
