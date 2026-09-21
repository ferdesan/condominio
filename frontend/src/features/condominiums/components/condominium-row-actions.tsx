import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
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
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${condominium.name}`}
          onClick={() => onRestore(condominium)}
        />
      </RowActions>
    );
  }

  return (
    <RowActions>
      {/* `to` e nao `onClick`: o `RowActions` desenha a ancora, e o detalhe
          continua abrindo em nova aba e mostrando o endereco na barra. */}
      <RowAction
        icon={Eye}
        label={`Ver ${condominium.name}`}
        to={`/condominios/${condominium.id}`}
      />

      {canUpdate ? (
        <RowAction
          icon={Pencil}
          label={`Editar ${condominium.name}`}
          onClick={() => onEdit(condominium)}
        />
      ) : null}

      {canDelete ? (
        <RowAction
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${condominium.name}`}
          onClick={() => onDelete(condominium)}
        />
      ) : null}
    </RowActions>
  );
}
