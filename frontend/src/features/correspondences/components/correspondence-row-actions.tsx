import { Button } from '@/components/ui/button';
import type { Correspondence } from '@/types/correspondence';
import { correspondenceLabel } from '../correspondence-labels';

export interface CorrespondenceRowActionsProps {
  correspondence: Correspondence;
  /** Baixa, edicao e restauracao exigem `correspondence:update` (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  onDeliver: (correspondence: Correspondence) => void;
  onEdit: (correspondence: Correspondence) => void;
  onDelete: (correspondence: Correspondence) => void;
  onRestore: (correspondence: Correspondence) => void;
}

/**
 * A baixa de entrega vive na propria linha (ADR-003): uma fila de dez retiradas
 * e resolvida sem sair da lista.
 *
 * Ela e oferecida sempre que o papel pode atualizar, sem olhar o status. Quem
 * decide se a baixa vale e o servidor — ele recusa a de um item ja entregue e a
 * de um devolvido —, e a mensagem dele e a resposta certa. Duplicar a regra aqui
 * so criaria uma segunda versao dela.
 *
 * Cada rotulo acessivel carrega o que identifica o item: numa tabela de vinte
 * linhas, "Dar baixa" sozinho nao diz em qual.
 */
export function CorrespondenceRowActions({
  correspondence,
  canUpdate,
  canDelete,
  onDeliver,
  onEdit,
  onDelete,
  onRestore,
}: CorrespondenceRowActionsProps) {
  const label = correspondenceLabel(correspondence);

  if (correspondence.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${label}`}
        onClick={() => onRestore(correspondence)}
      >
        Restaurar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Dar baixa em ${label}`}
            onClick={() => onDeliver(correspondence)}
          >
            Dar baixa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${label}`}
            onClick={() => onEdit(correspondence)}
          >
            Editar
          </Button>
        </>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${label}`}
          onClick={() => onDelete(correspondence)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
