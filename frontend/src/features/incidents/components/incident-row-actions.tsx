import { ArrowRightLeft, Pencil, RotateCcw, Trash2, UserPlus } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import type { Incident } from '@/types/incident';

export interface IncidentRowActionsProps {
  incident: Incident;
  /** Mudar status, editar e restaurar exigem `incident:update` (ADR-006). */
  canUpdate: boolean;
  /** Atribuir exige `incident:manage`, uma permissao acima das demais (ADR-002). */
  canManage: boolean;
  canDelete: boolean;
  onChangeStatus: (incident: Incident) => void;
  onAssign: (incident: Incident) => void;
  onEdit: (incident: Incident) => void;
  onDelete: (incident: Incident) => void;
  onRestore: (incident: Incident) => void;
}

/**
 * Acoes de atendimento na propria linha (ADR-003): uma fila de dez ocorrencias e
 * despachada sem sair da lista.
 *
 * As duas acoes de fluxo tem permissoes diferentes, e e essa a divisao que o
 * servidor faz: `POST /:id/status` exige `incident:update`, `POST /:id/assign`
 * exige `incident:manage`. Um papel com update ve mudar status e nao ve
 * atribuir.
 *
 * Nenhuma das duas olha o status para se oferecer. As transicoes validas sao do
 * servidor (`STATUS_FLOW`), e duplica-las aqui criaria uma segunda versao delas
 * que dessincroniza na primeira mudanca do backend — a recusa dele e a resposta
 * certa, e o dialogo tem onde mostra-la.
 *
 * Cada rotulo acessivel carrega o protocolo: numa tabela de vinte linhas,
 * "Atribuir" sozinho nao diz qual ocorrencia.
 */
export function IncidentRowActions({
  incident,
  canUpdate,
  canManage,
  canDelete,
  onChangeStatus,
  onAssign,
  onEdit,
  onDelete,
  onRestore,
}: IncidentRowActionsProps) {
  const label = incident.protocol;

  if (incident.deletedAt) {
    if (!canUpdate) return null;
    return (
      <IconButton
        icon={RotateCcw}
        label={`Restaurar ${label}`}
        onClick={() => onRestore(incident)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <IconButton
          icon={ArrowRightLeft}
          label={`Mudar status de ${label}`}
          onClick={() => onChangeStatus(incident)}
        />
      ) : null}

      {canManage ? (
        <IconButton
          icon={UserPlus}
          label={`Atribuir ${label}`}
          onClick={() => onAssign(incident)}
        />
      ) : null}

      {canUpdate ? (
        <IconButton icon={Pencil} label={`Editar ${label}`} onClick={() => onEdit(incident)} />
      ) : null}

      {canDelete ? (
        <IconButton
          icon={Trash2}
          tone="destructive"
          label={`Excluir ${label}`}
          onClick={() => onDelete(incident)}
        />
      ) : null}
    </div>
  );
}
