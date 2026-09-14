import { Button } from '@/components/ui/button';
import type { Block } from '@/types/api';

export interface BlockRowActionsProps {
  block: Block;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (block: Block) => void;
  onDelete: (block: Block) => void;
  onRestore: (block: Block) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz o que sera editado.
 */
export function BlockRowActions({
  block,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: BlockRowActionsProps) {
  if (block.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${block.name}`}
        onClick={() => onRestore(block)}
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
          aria-label={`Editar ${block.name}`}
          onClick={() => onEdit(block)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${block.name}`}
          onClick={() => onDelete(block)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
