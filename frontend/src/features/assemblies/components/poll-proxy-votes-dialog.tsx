import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Poll } from '@/types/assembly';
import { POLLS_KEY, useCastProxyVote, useVoteStatus } from '../assembly-hooks';
import { UNIT_VOTE_STATUS_LABELS } from '../assembly-labels';

export interface PollProxyVotesDialogProps {
  poll: Poll;
  onClose: () => void;
}

/** O recorte do filtro: todas as unidades, ou so as que aguardam registro. */
type StatusFilter = 'ALL' | 'PENDING';

/** Erro de registro por unidade, apresentado na propria linha. */
type RowErrors = Record<string, string>;

function withoutKey(record: RowErrors, key: string): RowErrors {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/**
 * Gestao de votos por unidade (ADR-003 / ADR-005 / ADR-007).
 *
 * Uma linha por unidade da votacao, com a numeracao e o status — **nunca a
 * alternativa escolhida**, secreta ou nao: o endpoint de status ja nao devolve
 * `optionId`, e a interface nao o fabrica. Quem entra aqui veio de Deliberacoes
 * com `vote:manage`; a janela da votacao e recusa do servidor, entao um poll
 * que nao esta OPEN mostra a lista legivel e uma mensagem clara, sem envio.
 *
 * A recusa do servidor (409 de unidade ja votada, 403 de elegibilidade)
 * aparece na linha que a provocou, e o proprio `onError` substitui o toast
 * global — dois avisos para a mesma coisa so confundem. No 409 o status e
 * refeito para que a lista reconcilie com o servidor (US-005 EC-4).
 */
export function PollProxyVotesDialog({ poll, onClose }: PollProxyVotesDialogProps) {
  const queryClient = useQueryClient();
  const status = useVoteStatus(poll.id);

  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<RowErrors>({});

  const isPollOpen = poll.status === 'OPEN';

  /*
    Fechar o dialogo invalida o status: o staleTime de 30s deixaria a
    reabertura servindo o cache antigo, e a gestao existe justamente para
    acompanhar votos que chegam por fora (US-005 EC-4 / US-002 EC-3).
  */
  useEffect(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: [POLLS_KEY, 'vote-status'] });
    };
  }, [queryClient]);

  const proxy = useCastProxyVote(poll.id, {
    onSuccess: (_data, variables) => {
      setErrors((current) => withoutKey(current, variables.unitId));
      setChoices((current) => {
        const { [variables.unitId]: _removed, ...rest } = current;
        return rest;
      });
    },
    onError: (error, variables) => {
      setErrors((current) => ({ ...current, [variables.unitId]: error.message }));
      // 409 e divergencia de estado: so o refetch traz a linha para o servidor.
      if (error.status === 409) void status.refetch();
    },
  });

  const rows = status.data ?? [];
  const visibleRows = rows.filter((row) => filter === 'ALL' || row.status === 'PENDING');

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestão de votos</DialogTitle>
          <DialogDescription>
            {poll.title}. Cada unidade aparece com o status do voto; a alternativa escolhida nunca
            é exibida.
          </DialogDescription>
        </DialogHeader>

        {!isPollOpen ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            A votação não está aberta. O registro de voto por unidade fica disponível quando a
            votação abrir.
          </p>
        ) : null}

        {status.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : status.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar o status das unidades.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="proxy-status-filter" className="text-sm font-medium">
                Exibir
              </label>
              <Select
                value={filter}
                onValueChange={(next) => setFilter(next as StatusFilter)}
              >
                <SelectTrigger id="proxy-status-filter" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {visibleRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filter === 'PENDING' ? 'Nenhuma unidade pendente.' : 'Nenhuma unidade encontrada.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleRows.map((row) => {
                  const canRegister = isPollOpen && row.status === 'PENDING';
                  const choice = choices[row.unitId];
                  const rowError = errors[row.unitId];

                  return (
                    <li key={row.unitId} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-16 font-medium tabular-nums">{row.unitNumber}</span>
                        <span className="text-sm text-muted-foreground">
                          {UNIT_VOTE_STATUS_LABELS[row.status]}
                        </span>

                        {canRegister ? (
                          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                            <fieldset className="flex flex-wrap items-center gap-3">
                              <legend className="sr-only">
                                Alternativa da unidade {row.unitNumber}
                              </legend>
                              {(poll.options ?? []).map((option) => (
                                <label
                                  key={option.id}
                                  className="flex cursor-pointer items-center gap-1 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={`proxy-option-${row.unitId}`}
                                    value={option.id}
                                    checked={choice === option.id}
                                    onChange={() =>
                                      setChoices((current) => ({
                                        ...current,
                                        [row.unitId]: option.id,
                                      }))
                                    }
                                    aria-label={`${option.label} da unidade ${row.unitNumber}`}
                                  />
                                  {option.label}
                                </label>
                              ))}
                            </fieldset>

                            <Button
                              type="button"
                              size="sm"
                              aria-label={`Registrar voto da unidade ${row.unitNumber}`}
                              disabled={!choice}
                              onClick={() => {
                                if (!choice) return;
                                proxy.mutate({ unitId: row.unitId, optionId: choice });
                              }}
                            >
                              Registrar voto
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {rowError ? (
                        <p role="alert" className="text-xs text-destructive">
                          {rowError}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
