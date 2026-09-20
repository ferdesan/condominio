import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
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
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${block.name}`}
        onClick={() => onRestore(block)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate ? (
        <IconButton icon={Pencil} label={`Editar ${block.name}`} onClick={() => onEdit(block)} />
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${block.name}`}
          onClick={() => onDelete(block)}
        />
      ) : null}
    </div>
  );
}
