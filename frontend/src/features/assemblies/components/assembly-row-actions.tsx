import { Ban, Pencil, Play, RotateCcw, Square, Trash2, Vote } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import type { Assembly } from '@/types/assembly';
import { assemblyLabel } from '../assembly-labels';

export interface AssemblyRowActionsProps {
  assembly: Assembly;
  /** Iniciar, encerrar, cancelar, editar e restaurar exigem `assembly:update`. */
  canUpdate: boolean;
  canDelete: boolean;
  /** Ver e conduzir deliberacoes exige `poll:read`. */
  canReadPolls: boolean;
  /** Recusa do servidor, apresentada na propria linha que a provocou. */
  error?: string;
  onStart: (assembly: Assembly) => void;
  onFinish: (assembly: Assembly) => void;
  onCancel: (assembly: Assembly) => void;
  onPolls: (assembly: Assembly) => void;
  onEdit: (assembly: Assembly) => void;
  onDelete: (assembly: Assembly) => void;
  onRestore: (assembly: Assembly) => void;
}

/**
 * As acoes de ciclo vivem na propria linha (ADR-003).
 *
 * **Sao oferecidas por permissao, e nao por situacao** — o padrao deste projeto.
 * Quem decide se a transicao vale e o servidor: ele recusa iniciar uma
 * assembleia que nao esta agendada, encerrar uma cancelada e cancelar uma
 * encerrada. Duplicar essas tres regras aqui criaria uma segunda versao delas,
 * que dessincroniza na primeira mudanca do backend — e a recusa e caminho
 * normal, com lugar proprio para aparecer.
 *
 * A excecao do ciclo linear (Comunicados, Manutencoes) exige que o requisito
 * peca o recorte na interface; aqui ele nao pede, entao vale o padrao.
 *
 * Cada rotulo acessivel carrega o titulo: numa tabela de vinte linhas,
 * "Iniciar" sozinho nao diz qual.
 */
export function AssemblyRowActions({
  assembly,
  canUpdate,
  canDelete,
  canReadPolls,
  error,
  onStart,
  onFinish,
  onCancel,
  onPolls,
  onEdit,
  onDelete,
  onRestore,
}: AssemblyRowActionsProps) {
  const label = assemblyLabel(assembly);

  if (assembly.deletedAt) {
    if (!canUpdate) return null;
    return (
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${label}`}
        onClick={() => onRestore(assembly)}
      />
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {canReadPolls ? (
          <IconButton
            icon={Vote}
            label={`Deliberações de ${label}`}
            onClick={() => onPolls(assembly)}
          />
        ) : null}

        {canUpdate ? (
          <>
            <IconButton icon={Play} label={`Iniciar ${label}`} onClick={() => onStart(assembly)} />
            <IconButton
              icon={Square}
              label={`Encerrar ${label}`}
              onClick={() => onFinish(assembly)}
            />
            <IconButton
              icon={Ban}
              tone="destructive"
              label={`Cancelar ${label}`}
              onClick={() => onCancel(assembly)}
            />
            <IconButton icon={Pencil} label={`Editar ${label}`} onClick={() => onEdit(assembly)} />
          </>
        ) : null}

        {canDelete ? (
          <IconButton
            icon={Trash2}
            tone="destructive"
            label={`Excluir ${label}`}
            onClick={() => onDelete(assembly)}
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
