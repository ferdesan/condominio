import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${employee.name}`}
        onClick={() => onRestore(employee)}
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
          aria-label={`Editar ${employee.name}`}
          onClick={() => onEdit(employee)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${employee.name}`}
          onClick={() => onDelete(employee)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
