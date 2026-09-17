import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Maintenance } from '@/types/maintenance';
import {
  maintenanceFilters,
  maintenanceHooks,
  MAINTENANCES_KEY,
  scopeToCondominium,
  useMaintenanceFlow,
  useResponsibleOptions,
  useServiceProviderOptions,
  type MaintenanceFlowAction,
} from './maintenance-hooks';
import {
  NO_ASSET,
  NO_PROVIDER,
  NO_RESPONSIBLE,
  PROVIDER_UNAVAILABLE,
  RECURRENCE_LABELS,
  RESPONSIBLE_UNAVAILABLE,
  TYPE_LABELS,
} from './maintenance-labels';
import { MaintenanceFilters } from './components/maintenance-filters';
import { MaintenanceFormDialog } from './components/maintenance-form-dialog';
import { MaintenanceRowActions } from './components/maintenance-row-actions';
import { MaintenanceStatusBadge } from './components/maintenance-status-badge';
import { UpcomingMaintenances } from './components/upcoming-maintenances';

const DESCRIPTION =
  'As ordens de manutencao do predio: o que esta agendado, o que esta em execucao e o que ja foi concluido.';

/**
 * `maintenance: null` cadastra; um registro edita. Ausente mantem o dialogo
 * fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { maintenance: Maintenance | null; condominiumId: string } | null;

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

export function MaintenancesPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Maintenance | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  /** Ids com uma acao de fluxo em voo, para que o segundo clique nao passe. */
  const inFlight = useRef(new Set<string>());

  const canCreate = can('maintenance:create');
  const canUpdate = can('maintenance:update');
  const canDelete = can('maintenance:delete');

  const providersQuery = useServiceProviderOptions(selectedId);
  const providers = useMemo(() => providersQuery.data?.data ?? [], [providersQuery.data]);
  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

  const responsiblesQuery = useResponsibleOptions(selectedId);
  // O recorte por condominio e do cliente: `/users` e por tenant e nao aceita
  // `condominiumId` como filtro, entao mandar a chave nao escoparia nada.
  const responsibles = useMemo(
    () => scopeToCondominium(responsiblesQuery.data?.data ?? [], selectedId),
    [responsiblesQuery.data, selectedId],
  );
  const responsiblesById = useMemo(
    () => new Map(responsibles.map((user) => [user.id, user])),
    [responsibles],
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
        ...pickFilters(maintenanceFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = maintenanceHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = maintenanceHooks.useRemove();
  const restore = maintenanceHooks.useRestore();

  /**
   * A recusa de uma transicao descreve um estado que a tela ainda nao reflete —
   * outra pessoa concluiu a ordem enquanto esta lista estava aberta. Atualizar a
   * lista faz parte da resposta, junto da mensagem na linha.
   *
   * Definir `onError` aqui substitui o toast global do React Query v5, que e o
   * que se quer: a mensagem ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  const flow = useMaintenanceFlow({
    onError: (error: ApiError, variables) =>
      setRowError({ id: variables.id, message: error.message }),
    onSuccess: () => setRowError(null),
  });

  function runFlow(action: MaintenanceFlowAction, maintenance: Maintenance): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por linha para
    // que duas ordens possam ser despachadas em sequencia rapida.
    if (inFlight.current.has(maintenance.id)) return;
    inFlight.current.add(maintenance.id);
    setRowError(null);

    flow.mutate(
      { id: maintenance.id, action },
      { onSettled: () => inFlight.current.delete(maintenance.id) },
    );
  }

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
  const responsibleFilter = list.filters.responsibleId;
  useEffect(() => {
    if (typeof responsibleFilter !== 'string' || responsibleFilter === '') return;
    if (!responsiblesQuery.isSuccess) return;
    if (responsibles.some((user) => user.id === responsibleFilter)) return;
    setFilter('responsibleId', undefined);
  }, [responsibleFilter, responsibles, responsiblesQuery.isSuccess, setFilter]);

  // Mesmo motivo do responsavel: os prestadores sao de um condominio so, e
  // trocar de predio deixa a chave anterior apontando para fora da colecao.
  const providerFilter = list.filters.serviceProviderId;
  useEffect(() => {
    if (typeof providerFilter !== 'string' || providerFilter === '') return;
    if (!providersQuery.isSuccess) return;
    if (providers.some((provider) => provider.id === providerFilter)) return;
    setFilter('serviceProviderId', undefined);
  }, [providerFilter, providers, providersQuery.isSuccess, setFilter]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [MAINTENANCES_KEY] });
  }

  /**
   * As tres situacoes do prestador, ditas por extenso.
   *
   * A listagem traz so o id, entao o nome sai da colecao ja carregada para o
   * seletor. Enquanto ela nao chegou, a celula usa o placeholder neutro —
   * anunciar "indisponivel" antes de ter procurado seria falso.
   */
  function providerCell(row: Maintenance) {
    if (!row.serviceProviderId) return <span className="text-muted-foreground">{NO_PROVIDER}</span>;
    if (!providersQuery.isSuccess) return '—';
    const provider = providersById.get(row.serviceProviderId);
    if (!provider) return <span className="text-muted-foreground">{PROVIDER_UNAVAILABLE}</span>;
    return provider.tradeName ?? provider.companyName;
  }

  /** Mesmas tres situacoes, para quem acompanha a ordem pelo condominio. */
  function responsibleCell(row: Maintenance) {
    if (!row.responsibleId) return <span className="text-muted-foreground">{NO_RESPONSIBLE}</span>;
    if (!responsiblesQuery.isSuccess) return '—';
    const user = responsiblesById.get(row.responsibleId);
    if (!user) return <span className="text-muted-foreground">{RESPONSIBLE_UNAVAILABLE}</span>;
    return user.name;
  }

  const columns: Column<Maintenance>[] = [
    {
      key: 'title',
      label: 'Titulo',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.title}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    {
      key: 'assetName',
      label: 'Ativo',
      sortable: true,
      render: (_value, row) =>
        row.assetName ?? <span className="text-muted-foreground">{NO_ASSET}</span>,
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type],
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <MaintenanceStatusBadge status={row.status} />,
    },
    {
      key: 'recurrence',
      label: 'Recorrencia',
      sortable: true,
      render: (_value, row) => RECURRENCE_LABELS[row.recurrence],
    },
    {
      // `scheduledFor` e a ordem padrao do servidor, mas nao esta na whitelist de
      // ordenacao dele — filtravel mais buscavel mais os dois timestamps —,
      // entao a coluna nao se oferece para ordenar.
      key: 'scheduledFor',
      label: 'Agendamento',
      render: (_value, row) => formatDateTime(row.scheduledFor),
    },
    {
      key: 'serviceProviderId',
      label: 'Prestador',
      sortable: true,
      render: (_value, row) => providerCell(row),
    },
    {
      key: 'responsibleId',
      label: 'Responsavel',
      sortable: true,
      render: (_value, row) => responsibleCell(row),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <MaintenanceRowActions
          maintenance={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onFlow={runFlow}
          onEdit={(maintenance) =>
            setFormTarget({ maintenance, condominiumId: maintenance.condominiumId })
          }
          onDelete={setDeleting}
          onRestore={(maintenance) => restore.mutate(maintenance.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Manutenções" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="As manutencoes sao listadas por condominio. Escolha um no topo da tela para continuar."
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
              title="Manutenções"
              description={DESCRIPTION}
              actions={
                canCreate ? (
                  <Button
                    onClick={() => setFormTarget({ maintenance: null, condominiumId: selectedId })}
                  >
                    Nova manutencao
                  </Button>
                ) : undefined
              }
            />

            {/*
              O que esta por vir vem de `/maintenances/upcoming`, que faz o
              recorte no servidor. Filtrar as linhas carregadas responderia outra
              pergunta: a lista mostra uma pagina e um recorte de filtros.
            */}
            <UpcomingMaintenances condominiumId={selectedId} />
          </div>
        }
        filters={
          <MaintenanceFilters list={list} providers={providers} responsibles={responsibles} />
        }
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma manutencao corresponde aos termos e filtros aplicados."
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
                  icon={Wrench}
                  title="Nenhuma manutencao registrada"
                  description="Nenhuma ordem foi aberta para este condominio ate agora."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() =>
                          setFormTarget({ maintenance: null, condominiumId: selectedId })
                        }
                      >
                        Agendar manutencao
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
                emptyIcon={Wrench}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <MaintenanceFormDialog
          key={formTarget.maintenance?.id ?? 'new'}
          maintenance={formTarget.maintenance ?? undefined}
          condominiumId={formTarget.condominiumId}
          providers={providers}
          responsibles={responsibles}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir manutencao?"
        description={
          deleting
            ? `${deleting.title} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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
