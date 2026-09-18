import { useMemo, useRef, useState } from 'react';
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
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DEFAULT_PER_PAGE, pickFilters } from '@/lib/crud';
import { formatDateTime } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { Assembly, Poll } from '@/types/assembly';
import { pollFilters, pollHooks, useClosePoll, useOpenPoll } from '../assembly-hooks';
import { NO_POLLS, POLL_VOTER_LABELS, pollLabel, weightingLabel } from '../assembly-labels';
import { PollFormDialog } from './poll-form-dialog';
import { PollResultsPanel } from './poll-results-panel';
import { PollStatusBadge } from './poll-status-badge';

export interface AssemblyPollsDialogProps {
  assembly: Assembly;
  onClose: () => void;
}

/** Recusa do servidor apresentada na deliberacao que a provocou. */
type RowError = { id: string; message: string } | null;

/**
 * As deliberacoes de uma assembleia, em dialogo sobre a lista (ADR-004).
 *
 * As votacoes sao um recurso proprio (`/polls`) que aponta para a assembleia por
 * `assemblyId` — o vinculo e opcional no servidor, entao a consulta e uma
 * listagem filtrada, e nao uma relacao aninhada. O recorte por assembleia vem da
 * whitelist do repositorio, que aceita `assemblyId`.
 *
 * Abrir e encerrar sao oferecidos por permissao, e nao por situacao: quem decide
 * se a transicao vale e o servidor — ele recusa abrir o que nao e rascunho e
 * encerrar o que ja esta apurado —, e a recusa aparece na propria deliberacao.
 */
export function AssemblyPollsDialog({ assembly, onClose }: AssemblyPollsDialogProps) {
  const { can } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<Poll | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Poll | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  const inFlight = useRef(new Set<string>());

  const canCreate = can('poll:create');
  const canUpdate = can('poll:update');
  const canDelete = can('poll:delete');

  const params = useMemo(
    () => ({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      filters: pickFilters(pollFilters, {
        condominiumId: assembly.condominiumId,
        assemblyId: assembly.id,
      }),
    }),
    [assembly.condominiumId, assembly.id],
  );

  const query = pollHooks.useList(params);
  const remove = pollHooks.useRemove();
  const polls = query.data?.data ?? [];

  const lifecycleCallbacks = {
    onError: (error: ApiError, variables: { id: string }) =>
      setRowError({ id: variables.id, message: error.message }),
    onSuccess: () => setRowError(null),
  };
  const open = useOpenPoll(lifecycleCallbacks);
  const close = useClosePoll(lifecycleCallbacks);

  function runLifecycle(action: 'open' | 'close', poll: Poll): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por deliberacao
    // para que duas possam ser conduzidas em sequencia rapida.
    if (inFlight.current.has(poll.id)) return;
    inFlight.current.add(poll.id);
    setRowError(null);

    const mutation = action === 'open' ? open : close;
    mutation.mutate({ id: poll.id }, { onSettled: () => inFlight.current.delete(poll.id) });
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Deliberações</DialogTitle>
            <DialogDescription>
              {assembly.title} · {formatDateTime(assembly.scheduledAt)}
            </DialogDescription>
          </DialogHeader>

          {canCreate ? (
            <div>
              <Button type="button" onClick={() => setFormTarget(null)}>
                Nova deliberação
              </Button>
            </div>
          ) : null}

          {query.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : query.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar as deliberações desta assembleia.
            </p>
          ) : polls.length === 0 ? (
            <p className="text-sm text-muted-foreground">{NO_POLLS}</p>
          ) : (
            <ul className="space-y-3">
              {polls.map((poll) => {
                const label = pollLabel(poll);
                const isExpanded = expanded === poll.id;

                return (
                  <li key={poll.id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{poll.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {POLL_VOTER_LABELS[poll.voterType]} ·{' '}
                          {weightingLabel(poll.weightedByFraction)} · encerra em{' '}
                          {formatDateTime(poll.endsAt)}
                        </p>
                      </div>
                      <PollStatusBadge status={poll.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={
                          isExpanded ? `Ocultar apuração de ${label}` : `Ver apuração de ${label}`
                        }
                        onClick={() => setExpanded(isExpanded ? null : poll.id)}
                      >
                        {isExpanded ? 'Ocultar apuração' : 'Ver apuração'}
                      </Button>

                      {canUpdate ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Abrir ${label}`}
                            onClick={() => runLifecycle('open', poll)}
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Apurar ${label}`}
                            onClick={() => runLifecycle('close', poll)}
                          >
                            Apurar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${label}`}
                            onClick={() => setFormTarget(poll)}
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
                          onClick={() => setDeleting(poll)}
                        >
                          Excluir
                        </Button>
                      ) : null}
                    </div>

                    {rowError?.id === poll.id ? (
                      <p role="alert" className="text-xs text-destructive">
                        {rowError.message}
                      </p>
                    ) : null}

                    {isExpanded ? <PollResultsPanel pollId={poll.id} /> : null}
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formTarget !== undefined ? (
        <PollFormDialog
          key={formTarget?.id ?? 'new'}
          poll={formTarget ?? undefined}
          condominiumId={assembly.condominiumId}
          assemblyId={assembly.id}
          onClose={() => setFormTarget(undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir deliberação?"
        description={
          deleting
            ? `"${deleting.title}" deixara de aparecer, junto dos votos já registrados nela. A exclusao e logica e pode ser desfeita.`
            : undefined
        }
        actionLabel="Excluir"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting || removingRef.current) return;
          removingRef.current = true;
          setRemoving(true);
          remove.mutate(deleting.id, {
            onSettled: () => {
              removingRef.current = false;
              setRemoving(false);
              setDeleting(null);
            },
          });
        }}
      />
    </>
  );
}
