import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar unidade ${unit.number}`}
        onClick={() => onRestore(unit)}
      >
        Restaurar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar unidade ${unit.number}`}
          onClick={() => onEdit(unit)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir unidade ${unit.number}`}
          onClick={() => onDelete(unit)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
