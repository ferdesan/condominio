import { Button } from '@/components/ui/button';
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
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${label}`}
        onClick={() => onRestore(incident)}
      >
        Restaurar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Mudar status de ${label}`}
          onClick={() => onChangeStatus(incident)}
        >
          Mudar status
        </Button>
      ) : null}

      {canManage ? (
        <Button
          variant="outline"
          size="sm"
          aria-label={`Atribuir ${label}`}
          onClick={() => onAssign(incident)}
        >
          Atribuir
        </Button>
      ) : null}

      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Editar ${label}`}
          onClick={() => onEdit(incident)}
        >
          Editar
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          aria-label={`Excluir ${label}`}
          onClick={() => onDelete(incident)}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
