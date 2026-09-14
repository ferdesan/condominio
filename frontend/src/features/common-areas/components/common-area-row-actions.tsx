import { Button } from '@/components/ui/button';
import type { CommonArea } from '@/types/api';

export interface CommonAreaRowActionsProps {
  area: CommonArea;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (area: CommonArea) => void;
  onDelete: (area: CommonArea) => void;
  onRestore: (area: CommonArea) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz o que sera editado.
 */
export function CommonAreaRowActions({
  area,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: CommonAreaRowActionsProps) {
  if (area.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${area.name}`}
        onClick={() => onRestore(area)}
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
          aria-label={`Editar ${area.name}`}
          onClick={() => onEdit(area)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${area.name}`}
          onClick={() => onDelete(area)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
