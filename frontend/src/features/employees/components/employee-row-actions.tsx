import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import type { Employee } from '@/types/api';

export interface EmployeeRowActionsProps {
  employee: Employee;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onRestore: (employee: Employee) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz quem sera editado.
 */
export function EmployeeRowActions({
  employee,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: EmployeeRowActionsProps) {
  if (employee.deletedAt) {
    if (!canUpdate) return null;
    return (
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${employee.name}`}
        onClick={() => onRestore(employee)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdate ? (
        <IconButton
          icon={Pencil}
          label={`Editar ${employee.name}`}
          onClick={() => onEdit(employee)}
        />
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${employee.name}`}
          onClick={() => onDelete(employee)}
        />
      ) : null}
    </div>
  );
}
