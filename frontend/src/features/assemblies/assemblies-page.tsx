import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX, Vote } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Assembly } from '@/types/assembly';
import {
  ASSEMBLIES_KEY,
  assemblyFilters,
  assemblyHooks,
  useCancelAssembly,
  useStartAssembly,
} from './assembly-hooks';
import {
  ASSEMBLY_MODE_LABELS,
  ASSEMBLY_TYPE_LABELS,
  NO_LOCATION,
  NO_SECOND_CALL,
} from './assembly-labels';
import { AssemblyFilters } from './components/assembly-filters';
import { AssemblyFinishDialog } from './components/assembly-finish-dialog';
import { AssemblyFormDialog } from './components/assembly-form-dialog';
import { AssemblyPollsDialog } from './components/assembly-polls-dialog';
import { AssemblyRowActions } from './components/assembly-row-actions';
import { AssemblyStatusBadge } from './components/assembly-status-badge';
import { UpcomingAssemblies } from './components/upcoming-assemblies';

const DESCRIPTION =
  'Convocacoes ordinarias e extraordinarias, o quorum de cada uma e as deliberacoes levadas a voto.';

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

/** O dialogo guarda o condominio com que foi aberto (ADR-004). */
type FormTarget = { assembly: Assembly | null; condominiumId: string } | null;

/**
 * Assembleias do condominio.
 *
 * As tres acoes de ciclo — iniciar, encerrar e cancelar — sao oferecidas por
 * permissao, e nao por situacao. Quem decide se a transicao vale e o servidor, e
 * a recusa dele aparece na propria linha: duplicar as regras aqui criaria uma
 * segunda versao delas, que dessincroniza na primeira mudanca do backend.
 *
 * Encerrar e a unica que abre dialogo, porque exige corpo — o numero de
 * presentes e, quando houver, a ata.
 */
export function AssembliesPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [finishing, setFinishing] = useState<Assembly | null>(null);
  const [pollsOf, setPollsOf] = useState<Assembly | null>(null);
  const [deleting, setDeleting] = useState<Assembly | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  const inFlight = useRef(new Set<string>());

  const canCreate = can('assembly:create');
  const canUpdate = can('assembly:update');
  const canDelete = can('assembly:delete');
  const canReadPolls = can('poll:read');

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: pickFilters(assemblyFilters, {
        ...base.filters,
        condominiumId: selectedId ?? '',
      }),
    };
  }, [list, selectedId]);

  const query = assemblyHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = assemblyHooks.useRemove();
  const restore = assemblyHooks.useRestore();

  /**
   * A recusa descreve algo sobre esta assembleia. Definir `onError` aqui
   * substitui o toast global do React Query v5, que e o que se quer: a mensagem
   * ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  const lifecycleCallbacks = {
    onError: (error: ApiError, variables: { id: string }) => {
      // A recusa descreve um estado que a tela ainda nao reflete.
      queryClient.invalidateQueries({ queryKey: [ASSEMBLIES_KEY] });
      setRowError({ id: variables.id, message: error.message });
    },
    onSuccess: () => setRowError(null),
  };
  const start = useStartAssembly(lifecycleCallbacks);
  const cancel = useCancelAssembly(lifecycleCallbacks);

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function runLifecycle(action: 'start' | 'cancel', assembly: Assembly): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por linha para
    // que duas assembleias possam ser conduzidas em sequencia rapida.
    if (inFlight.current.has(assembly.id)) return;
    inFlight.current.add(assembly.id);
    setRowError(null);

    const mutation = action === 'start' ? start : cancel;
    mutation.mutate({ id: assembly.id }, { onSettled: () => inFlight.current.delete(assembly.id) });
  }

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [ASSEMBLIES_KEY] });
  }

  const columns: Column<Assembly>[] = [
    {
      key: 'title',
      label: 'Assembleia',
      sortable: true,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={row.deletedAt ? 'line-through' : 'font-medium'}>{row.title}</span>
            {/* A tarja nomeia o estado: cor sozinha nao distingue removido. */}
            {row.deletedAt ? <Badge variant="destructive">Removida</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{row.location ?? NO_LOCATION}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => ASSEMBLY_TYPE_LABELS[row.type],
    },
    {
      // Nao ordenavel: `scheduledAt` e o `defaultSort` e **nao** entra no
      // conjunto ordenavel do servidor — a chave seria descartada em silencio.
      key: 'scheduledAt',
      label: 'Quando',
      render: (_value, row) => (
        <div className="whitespace-nowrap">
          <p>{formatDateTime(row.scheduledAt)}</p>
          <p className="text-xs text-muted-foreground">
            {row.secondCallAt ? `2a chamada: ${formatDateTime(row.secondCallAt)}` : NO_SECOND_CALL}
          </p>
        </div>
      ),
    },
    {
      key: 'mode',
      label: 'Formato',
      sortable: true,
      render: (_value, row) => ASSEMBLY_MODE_LABELS[row.mode],
    },
    {
      key: 'status',
      label: 'Situacao',
      sortable: true,
      render: (_value, row) => <AssemblyStatusBadge status={row.status} />,
    },
    {
      key: 'attendeesCount',
      label: 'Presentes',
      render: (_value, row) => (
        <span className="whitespace-nowrap">
          {formatNumber(row.attendeesCount)}{' '}
          <span className="text-xs text-muted-foreground">(quorum {row.quorumPercent}%)</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <AssemblyRowActions
          assembly={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canReadPolls={canReadPolls}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onStart={(assembly) => runLifecycle('start', assembly)}
          onCancel={(assembly) => runLifecycle('cancel', assembly)}
          onFinish={setFinishing}
          onPolls={setPollsOf}
          onEdit={(assembly) => setFormTarget({ assembly, condominiumId: assembly.condominiumId })}
          onDelete={setDeleting}
          onRestore={(assembly) => restore.mutate(assembly.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Assembleias" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="As assembleias sao listadas por condominio. Escolha um no topo da tela para continuar."
            />
          </div>
        }
      />
    );
  }

  return (
    <>
      <CrudLayout
        header={
          <PageHeader
            title="Assembleias"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  onClick={() => setFormTarget({ assembly: null, condominiumId: selectedId })}
                >
                  Nova assembleia
                </Button>
              ) : undefined
            }
          />
        }
        filters={
          <div className="space-y-4">
            <UpcomingAssemblies condominiumId={selectedId} />
            <AssemblyFilters list={list} />
          </div>
        }
        content={
          <div className="space-y-4 p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma assembleia corresponde aos termos e filtros aplicados."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        list.setSearch('');
                        list.clearFilters();
                      }}
                    >
                      Limpar busca
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Vote}
                  title="Nenhuma assembleia registrada"
                  description="Convocacoes ordinarias e extraordinarias ficam aqui, com pauta, quorum e deliberacoes."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ assembly: null, condominiumId: selectedId })}
                      >
                        Convocar a primeira
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                idKey="id"
                loading={query.isPending}
                // A busca mora no painel de filtros, junto dos demais controles.
                searchable={false}
                sort={list.sort}
                onSort={list.setSort}
                pageable
                pageSize={DEFAULT_PER_PAGE}
                currentPage={page}
                totalPages={totalPages ?? 1}
                onPageChange={setPage}
                emptyIcon={Vote}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        <AssemblyFormDialog
          key={formTarget.assembly?.id ?? 'new'}
          assembly={formTarget.assembly ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {finishing ? (
        <AssemblyFinishDialog assembly={finishing} onClose={() => setFinishing(null)} />
      ) : null}

      {pollsOf ? <AssemblyPollsDialog assembly={pollsOf} onClose={() => setPollsOf(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir assembleia?"
        description={
          deleting
            ? `"${deleting.title}" deixara de aparecer na listagem, junto das deliberacoes vinculadas. A exclusao e logica e pode ser desfeita.`
            : undefined
        }
        actionLabel="Excluir"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          // O `isPending` da mutacao so muda no proximo tick, entao dois cliques
          // no mesmo passariam os dois. O trinco fecha na hora.
          if (!deleting || removingRef.current) return;
          removingRef.current = true;
          setRemoving(true);
          remove.mutate(deleting.id, {
            onError: refreshOnRefusal,
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
