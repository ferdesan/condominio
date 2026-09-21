import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { ServiceProvider } from '@/types/api';

export interface ServiceProviderRowActionsProps {
  provider: ServiceProvider;
  /** Restaurar exige `update`, nao `delete` — e a mesma regra do servidor (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (provider: ServiceProvider) => void;
  onDelete: (provider: ServiceProvider) => void;
  onRestore: (provider: ServiceProvider) => void;
}

/**
 * Cada acao carrega a razao social no rotulo acessivel: numa tabela de vinte
 * linhas, "Editar" sozinho nao diz quem sera editado.
 */
export function ServiceProviderRowActions({
  provider,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onRestore,
}: ServiceProviderRowActionsProps) {
  if (provider.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${provider.companyName}`}
          onClick={() => onRestore(provider)}
        />
      </RowActions>
    );
  }

  return (
    <RowActions>
      {canUpdate ? (
        <RowAction
          icon={Pencil}
          label={`Editar ${provider.companyName}`}
          onClick={() => onEdit(provider)}
        />
      ) : null}

      {canDelete ? (
        <RowAction
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${provider.companyName}`}
          onClick={() => onDelete(provider)}
        />
      ) : null}
    </RowActions>
  );
}
