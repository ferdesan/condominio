import { LogIn, LogOut, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { RowAction, RowActions } from '@/components/ui/row-actions';
import type { Visitor } from '@/types/visitor';

export type VisitorFlowAction = 'check-in' | 'check-out';

export interface VisitorRowActionsProps {
  visitor: Visitor;
  /** Entrada, saida, edicao e restauracao exigem `visitor:update` (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  /** Recusa do servidor para esta linha. Fica onde a acao foi disparada. */
  error?: string;
  onFlow: (action: VisitorFlowAction, visitor: Visitor) => void;
  onEdit: (visitor: Visitor) => void;
  onDelete: (visitor: Visitor) => void;
  onRestore: (visitor: Visitor) => void;
}

/**
 * Acoes de portaria na propria linha (ADR-003): uma fila de dez chegadas e
 * resolvida sem sair da lista.
 *
 * Entrada e saida sao oferecidas sempre que o papel pode atualizar, sem olhar o
 * status. Quem decide se a transicao vale e o servidor — ele recusa entrada de
 * quem ja esta dentro e saida de quem nao entrou —, e a mensagem dele e a
 * resposta certa. Duplicar a regra aqui so criaria uma segunda versao dela, que
 * dessincroniza na primeira mudanca do backend.
 *
 * Cada rotulo acessivel carrega o nome do visitante: numa tabela de vinte
 * linhas, "Registrar entrada" sozinho nao diz de quem.
 */
export function VisitorRowActions({
  visitor,
  canUpdate,
  canDelete,
  error,
  onFlow,
  onEdit,
  onDelete,
  onRestore,
}: VisitorRowActionsProps) {
  if (visitor.deletedAt) {
    if (!canUpdate) return null;
    return (
      <RowActions>
        <RowAction
          icon={RotateCcw}
          label={`Restaurar ${visitor.name}`}
          onClick={() => onRestore(visitor)}
        />
      </RowActions>
    );
  }

  return (
    <div className="space-y-1">
      <RowActions>
        {canUpdate ? (
          <>
            <RowAction
              icon={LogIn}
              label={`Registrar entrada de ${visitor.name}`}
              onClick={() => onFlow('check-in', visitor)}
            />
            <RowAction
              icon={LogOut}
              label={`Registrar saída de ${visitor.name}`}
              onClick={() => onFlow('check-out', visitor)}
            />
            <RowAction
              icon={Pencil}
              label={`Editar ${visitor.name}`}
              onClick={() => onEdit(visitor)}
            />
          </>
        ) : null}

        {canDelete ? (
          <RowAction
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${visitor.name}`}
            onClick={() => onDelete(visitor)}
          />
        ) : null}
      </RowActions>

      {/*
        A recusa aparece na linha, e não em toast: e sobre este visitante, e a
        próxima coisa a fazer esta a dois centimetros dela.
      */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
