import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Condominium } from '@/types/api';

export interface CondominiumRowActionsProps {
  condominium: Condominium;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (condominium: Condominium) => void;
  onDelete: (condominium: Condominium) => void;
  onRestore: (condominium: Condominium) => void;
}

/**
 * Cada acao carrega o nome do registro no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz o que sera editado.
 */
export function CondominiumRowActions({
  condominium,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: CondominiumRowActionsProps) {
  if (condominium.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${condominium.name}`}
        onClick={() => onRestore(condominium)}
      >
        Restaurar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/condominios/${condominium.id}`} aria-label={`Ver ${condominium.name}`}>
          Ver
        </Link>
      </Button>

      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar ${condominium.name}`}
          onClick={() => onEdit(condominium)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${condominium.name}`}
          onClick={() => onDelete(condominium)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
