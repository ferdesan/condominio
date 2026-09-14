import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${provider.companyName}`}
        onClick={() => onRestore(provider)}
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
          aria-label={`Editar ${provider.companyName}`}
          onClick={() => onEdit(provider)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${provider.companyName}`}
          onClick={() => onDelete(provider)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
