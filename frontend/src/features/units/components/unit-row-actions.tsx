import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Unit } from '@/types/api';

export interface UnitRowActionsProps {
  unit: Unit;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
  onRestore: (unit: Unit) => void;
}

/**
 * Cada acao carrega o numero da unidade no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz o que sera editado.
 */
export function UnitRowActions({
  unit,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: UnitRowActionsProps) {
  if (unit.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar unidade ${unit.number}`}
          onClick={() => onRestore(unit)}
        />
      </RowActions>
    );
  }

  return (
    <RowActions>
      {canUpdate ? (
        <RowAction
          icon={Pencil}
          label={`Editar unidade ${unit.number}`}
          onClick={() => onEdit(unit)}
        />
      ) : null}

      {canDelete ? (
        <RowAction
          icon={Trash2}
          tone="destructive"
          label={`Excluir unidade ${unit.number}`}
          onClick={() => onDelete(unit)}
        />
      ) : null}
    </RowActions>
  );
}
