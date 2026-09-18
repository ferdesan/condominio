import { Button } from '@/components/ui/button';
import type { Maintenance } from '@/types/maintenance';
import type { MaintenanceFlowAction } from '../maintenance-hooks';

export interface MaintenanceRowActionsProps {
  maintenance: Maintenance;
  /** Iniciar, concluir, cancelar, editar e restaurar exigem `maintenance:update` (ADR-006). */
  canUpdate: boolean;
  canDelete: boolean;
  /** Recusa do servidor para esta linha. Fica onde a acao foi disparada. */
  error?: string;
  onFlow: (action: MaintenanceFlowAction, maintenance: Maintenance) => void;
  onEdit: (maintenance: Maintenance) => void;
  onDelete: (maintenance: Maintenance) => void;
  onRestore: (maintenance: Maintenance) => void;
}

/**
 * As tres acoes do ciclo vivem na propria linha (ADR-003): uma fila de dez
 * ordens e despachada sem sair da lista.
 *
 * Aqui o status importa, como em comunicados e ao contrario das demais telas
 * deste tier. O ciclo da ordem e linear e sem volta — agendada inicia, iniciada
 * conclui, e concluida nao aceita mais nada — e oferecer o botao que so pode ser
 * recusado seria oferecer um beco. O recorte nunca oferece o que o servidor
 * recusaria: `maintenance.service.ts` barra iniciar e concluir a partir de
 * `COMPLETED` e de `CANCELED`, e barra cancelar a partir de `COMPLETED`.
 *
 * `OVERDUE` nao e um destino escolhido por ninguem — o job diario move para ele
 * o que estava agendado e venceu —, e para o servidor ele vale exatamente como
 * `SCHEDULED`. Uma ordem atrasada continua sendo uma ordem que comeca.
 *
 * O que sobra de incerto continua sendo do servidor: a ordem pode ter avancado
 * por outra pessoa enquanto esta lista estava na tela, e a recusa dele aparece na
 * linha, com o status intacto.
 *
 * Cada rotulo acessivel carrega o titulo da ordem: numa tabela de vinte linhas,
 * "Concluir" sozinho nao diz qual.
 */
export function MaintenanceRowActions({
  maintenance,
  canUpdate,
  canDelete,
  error,
  onFlow,
  onEdit,
  onDelete,
  onRestore,
}: MaintenanceRowActionsProps) {
  const label = maintenance.title;

  if (maintenance.deletedAt) {
    if (!canUpdate) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={`Restaurar ${label}`}
        onClick={() => onRestore(maintenance)}
      >
        Restaurar
      </Button>
    );
  }

  const isPending = maintenance.status === 'SCHEDULED' || maintenance.status === 'OVERDUE';
  const isRunning = maintenance.status === 'IN_PROGRESS';
  const isClosed = maintenance.status === 'COMPLETED' || maintenance.status === 'CANCELED';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {canUpdate ? (
          <>
            {isPending ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Iniciar ${label}`}
                onClick={() => onFlow('start', maintenance)}
              >
                Iniciar
              </Button>
            ) : null}

            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Concluir ${label}`}
                onClick={() => onFlow('complete', maintenance)}
              >
                Concluir
              </Button>
            ) : null}

            {isClosed ? null : (
              <Button
                variant="outline"
                size="sm"
                aria-label={`Cancelar ${label}`}
                onClick={() => onFlow('cancel', maintenance)}
              >
                Cancelar
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              aria-label={`Editar ${label}`}
              onClick={() => onEdit(maintenance)}
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
            onClick={() => onDelete(maintenance)}
          >
            Excluir
          </Button>
        ) : null}
      </div>

      {/*
        A recusa aparece na linha, e não em toast: e sobre esta ordem, e a
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
