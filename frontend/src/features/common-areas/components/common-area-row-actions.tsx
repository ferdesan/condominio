import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
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
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${area.name}`}
        onClick={() => onRestore(area)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate ? (
        <IconButton icon={Pencil} label={`Editar ${area.name}`} onClick={() => onEdit(area)} />
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${area.name}`}
          onClick={() => onDelete(area)}
        />
      ) : null}
    </div>
  );
}
