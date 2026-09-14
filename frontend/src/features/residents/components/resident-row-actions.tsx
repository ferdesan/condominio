import { Button } from '@/components/ui/button';
import type { Resident } from '@/types/api';

export interface ResidentRowActionsProps {
  resident: Resident;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (resident: Resident) => void;
  onDelete: (resident: Resident) => void;
  onRestore: (resident: Resident) => void;
  onDesignatePrimary: (resident: Resident) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz quem sera editado.
 */
export function ResidentRowActions({
  resident,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
  onDesignatePrimary,
}: ResidentRowActionsProps) {
  if (resident.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${resident.name}`}
        onClick={() => onRestore(resident)}
      >
        Restaurar
      </Button>
    );
  }

  // Um responsavel inativo e um contato que nao responde. A acao continua
  // visivel e desabilitada, com o motivo no titulo: escondendo-a, quem procura
  // por ela nao descobre por que sumiu (US-016.EC-5).
  const primaryBlocked = resident.status !== 'ACTIVE';

  return (
    <div className="flex items-center gap-2">
      {canUpdate && !resident.isPrimary ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={primaryBlocked}
          title={
            primaryBlocked
              ? 'Apenas um morador ativo pode ser o responsavel pela unidade.'
              : undefined
          }
          aria-label={`Tornar ${resident.name} responsavel pela unidade`}
          onClick={() => onDesignatePrimary(resident)}
        >
          Tornar responsavel
        </Button>
      ) : null}

      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar ${resident.name}`}
          onClick={() => onEdit(resident)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${resident.name}`}
          onClick={() => onDelete(resident)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
