import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ClipboardList, SearchX, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Incident } from '@/types/incident';
import {
  incidentFilters,
  incidentHooks,
  INCIDENTS_KEY,
  scopeAssignees,
  useAssigneeOptions,
} from './incident-hooks';
import {
  ANONYMOUS_REPORTER,
  ASSIGNEE_UNAVAILABLE,
  CATEGORY_LABELS,
  NO_ASSIGNEE,
} from './incident-labels';
import { IncidentFilters } from './components/incident-filters';
import { IncidentFormDialog } from './components/incident-form-dialog';
import { IncidentIndicators } from './components/incident-indicators';
import { IncidentPriorityBadge } from './components/incident-priority-badge';
import { IncidentStatusBadge } from './components/incident-status-badge';
import { IncidentAssignDialog } from './components/incident-assign-dialog';
import { IncidentStatusDialog } from './components/incident-status-dialog';
import { IncidentRowActions } from './components/incident-row-actions';

const DESCRIPTION =
  'O que os moradores relataram, em que pe esta cada atendimento e quem esta cuidando.';

/**
 * `incident: null` cadastra; um registro edita. Ausente mantem o dialogo
 * fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { incident: Incident | null; condominiumId: string } | null;

export function IncidentsPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [changingStatus, setChangingStatus] = useState<Incident | null>(null);
  const [assigning, setAssigning] = useState<Incident | null>(null);
  const [deleting, setDeleting] = useState<Incident | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('incident:create');
  const canUpdate = can('incident:update');
  const canDelete = can('incident:delete');
  // Atribuir exige `manage`, e nao `update`: um papel que pode mudar o status
  // nao necessariamente pode escolher quem atende (ADR-002).
  const canManage = can('incident:manage');

  const assigneesQuery = useAssigneeOptions(selectedId);
  // O recorte por condominio e do cliente: `/users` e por tenant e nao aceita
  // `condominiumId` como filtro, entao mandar a chave nao escoparia nada.
  const assignees = useMemo(
    () => scopeAssignees(assigneesQuery.data?.data ?? [], selectedId),
    [assigneesQuery.data, selectedId],
  );
  const assigneesById = useMemo(
    () => new Map(assignees.map((user) => [user.id, user])),
    [assignees],
  );

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(incidentFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = incidentHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = incidentHooks.useRemove();
  const restore = incidentHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // O responsavel filtrado pode nao ter acesso ao condominio recem-selecionado,
  // ou ter saido da lista. Manter a chave devolveria uma lista vazia sem
  // explicacao.
  const assigneeFilter = list.filters.assignedToId;
  useEffect(() => {
    if (typeof assigneeFilter !== 'string' || assigneeFilter === '') return;
    if (!assigneesQuery.isSuccess) return;
    if (assignees.some((user) => user.id === assigneeFilter)) return;
    setFilter('assignedToId', undefined);
  }, [assigneeFilter, assignees, assigneesQuery.isSuccess, setFilter]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
  }

  /**
   * As tres situacoes do responsavel, ditas por extenso.
   *
   * A listagem traz so o id, entao o nome sai da colecao ja carregada para o
   * seletor. Enquanto ela nao chegou, a celula usa o placeholder neutro —
   * anunciar "indisponivel" antes de ter procurado seria falso.
   */
  function assigneeCell(row: Incident) {
    if (!row.assignedToId) return <span className="text-muted-foreground">{NO_ASSIGNEE}</span>;
    if (!assigneesQuery.isSuccess) return '—';
    const user = assigneesById.get(row.assignedToId);
    if (!user) return <span className="text-muted-foreground">{ASSIGNEE_UNAVAILABLE}</span>;
    return user.name;
  }

  const columns: Column<Incident>[] = [
    {
      key: 'protocol',
      label: 'Protocolo',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'font-mono line-through' : 'font-mono'}>
            {row.protocol}
          </span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    { key: 'title', label: 'Título', sortable: true },
    {
      key: 'category',
      label: 'Categoria',
      sortable: true,
      render: (_value, row) => CATEGORY_LABELS[row.category],
    },
    {
      key: 'priority',
      label: 'Prioridade',
      sortable: true,
      render: (_value, row) => <IncidentPriorityBadge priority={row.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <IncidentStatusBadge status={row.status} />,
    },
    { key: 'location', label: 'Local', sortable: true },
    {
      key: 'assignedToId',
      label: 'Responsável',
      sortable: true,
      render: (_value, row) => assigneeCell(row),
    },
    {
      key: 'reportedByName',
      label: 'Relatado por',
      render: (_value, row) =>
        row.reportedByName ?? <span className="text-muted-foreground">{ANONYMOUS_REPORTER}</span>,
    },
    {
      key: 'createdAt',
      label: 'Aberta em',
      sortable: true,
      render: (_value, row) => formatDateTime(row.createdAt),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <IncidentRowActions
          incident={row}
          canUpdate={canUpdate}
          canManage={canManage}
          canDelete={canDelete}
          onChangeStatus={setChangingStatus}
          onAssign={setAssigning}
          onEdit={(incident) => setFormTarget({ incident, condominiumId: incident.condominiumId })}
          onDelete={setDeleting}
          onRestore={(incident) => restore.mutate(incident.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Ocorrências" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condomínio"
              description="As ocorrências sao listadas por condomínio. Escolha um no topo da tela para continuar."
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
          <div className="space-y-4">
            <PageHeader
              title="Ocorrências"
              description={DESCRIPTION}
              actions={
                canCreate ? (
                  <Button
                    onClick={() => setFormTarget({ incident: null, condominiumId: selectedId })}
                  >
                    Nova ocorrência
                  </Button>
                ) : undefined
              }
            />

            {/*
              Os numeros vem de `/incidents/summary`, que agrupa no servidor.
              Contar as linhas carregadas responderia outra pergunta: a lista
              mostra uma pagina e um recorte de filtros.
            */}
            <IncidentIndicators condominiumId={selectedId} />
          </div>
        }
        filters={<IncidentFilters list={list} assignees={assignees} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma ocorrência corresponde aos termos e filtros aplicados."
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
                  icon={TriangleAlert}
                  title="Nenhuma ocorrência registrada"
                  description="Nada foi relatado neste condomínio até agora."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ incident: null, condominiumId: selectedId })}
                      >
                        Registrar ocorrência
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
                emptyIcon={ClipboardList}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <IncidentFormDialog
          key={formTarget.incident?.id ?? 'new'}
          incident={formTarget.incident ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {changingStatus ? (
        <IncidentStatusDialog
          key={changingStatus.id}
          incident={changingStatus}
          onClose={() => setChangingStatus(null)}
        />
      ) : null}

      {assigning ? (
        <IncidentAssignDialog
          key={assigning.id}
          incident={assigning}
          assignees={assignees}
          onClose={() => setAssigning(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir ocorrência?"
        description={
          deleting
            ? `${deleting.protocol} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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
