import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Dependent } from '@/types/api';

export interface DependentRowActionsProps {
  dependent: Dependent;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (dependent: Dependent) => void;
  onDelete: (dependent: Dependent) => void;
  onRestore: (dependent: Dependent) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz quem sera editado.
 */
export function DependentRowActions({
  dependent,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: DependentRowActionsProps) {
  if (dependent.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${dependent.name}`}
          onClick={() => onRestore(dependent)}
        />
      </RowActions>
    );
  }

  return (
    <RowActions>
      {canUpdate ? (
        <RowAction
          icon={Pencil}
          label={`Editar ${dependent.name}`}
          onClick={() => onEdit(dependent)}
        />
      ) : null}

      {canDelete ? (
        <RowAction
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${dependent.name}`}
          onClick={() => onDelete(dependent)}
        />
      ) : null}
    </RowActions>
  );
}
