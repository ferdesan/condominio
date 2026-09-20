import { PackageCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
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
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${label}`}
        onClick={() => onRestore(correspondence)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <>
          <IconButton
            icon={PackageCheck}
            label={`Dar baixa em ${label}`}
            onClick={() => onDeliver(correspondence)}
          />
          <IconButton
            icon={Pencil}
            label={`Editar ${label}`}
            onClick={() => onEdit(correspondence)}
          />
        </>
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${label}`}
          onClick={() => onDelete(correspondence)}
        />
      ) : null}
    </div>
  );
}
