import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${dependent.name}`}
        onClick={() => onRestore(dependent)}
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
          aria-label={`Editar ${dependent.name}`}
          onClick={() => onEdit(dependent)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${dependent.name}`}
          onClick={() => onDelete(dependent)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
