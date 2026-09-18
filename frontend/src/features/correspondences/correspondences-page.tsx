import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Inbox, PackagePlus, SearchX } from 'lucide-react';
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
import type { Correspondence } from '@/types/correspondence';
import {
  correspondenceFilters,
  correspondenceHooks,
  CORRESPONDENCES_KEY,
  usePendingCount,
  useResidentOptions,
  useUnitOptions,
} from './correspondence-hooks';
import {
  correspondenceLabel,
  NO_RESIDENT,
  TYPE_LABELS,
  UNIT_REMOVED,
  unitLabel,
} from './correspondence-labels';
import { CorrespondenceFilters } from './components/correspondence-filters';
import { CorrespondenceFormDialog } from './components/correspondence-form-dialog';
import { CorrespondenceDeliverDialog } from './components/correspondence-deliver-dialog';
import { CorrespondenceStatusBadge } from './components/correspondence-status-badge';
import { CorrespondenceRowActions } from './components/correspondence-row-actions';

const DESCRIPTION = 'O que a portaria recebeu, para quem, e o que ainda aguarda retirada.';

/** Dito quando havia destinatario e o morador referido nao esta mais acessivel. */
const RESIDENT_UNAVAILABLE = 'Destinatário indisponível';

/**
 * `correspondence: null` cadastra; um registro edita. Ausente mantem o dialogo
 * fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { correspondence: Correspondence | null; condominiumId: string } | null;

export function CorrespondencesPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [delivering, setDelivering] = useState<Correspondence | null>(null);
  const [deleting, setDeleting] = useState<Correspondence | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('correspondence:create');
  const canUpdate = can('correspondence:update');
  const canDelete = can('correspondence:delete');

  const unitsQuery = useUnitOptions(selectedId);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);
  const residentsQuery = useResidentOptions(selectedId);
  const residents = useMemo(() => residentsQuery.data?.data ?? [], [residentsQuery.data]);
  const residentsById = useMemo(
    () => new Map(residents.map((resident) => [resident.id, resident])),
    [residents],
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
        ...pickFilters(correspondenceFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = correspondenceHooks.useList(params, { enabled: Boolean(selectedId) });
  const pending = usePendingCount(selectedId);
  const remove = correspondenceHooks.useRemove();
  const restore = correspondenceHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Unidades e moradores nao atravessam condominios: trocar a selecao do shell
  // torna inexistentes aqui os dois filtros de vinculo.
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('unitId', undefined);
    setFilter('residentId', undefined);
  }, [selectedId, setFilter]);

  // O vinculo filtrado pode ter sido removido enquanto o filtro seguia ativo.
  // Manter a chave devolveria uma lista vazia sem explicacao.
  const unitFilter = list.filters.unitId;
  useEffect(() => {
    if (typeof unitFilter !== 'string' || unitFilter === '') return;
    if (!unitsQuery.isSuccess) return;
    if (units.some((unit) => unit.id === unitFilter)) return;
    setFilter('unitId', undefined);
  }, [unitFilter, units, unitsQuery.isSuccess, setFilter]);

  const residentFilter = list.filters.residentId;
  useEffect(() => {
    if (typeof residentFilter !== 'string' || residentFilter === '') return;
    if (!residentsQuery.isSuccess) return;
    if (residents.some((resident) => resident.id === residentFilter)) return;
    setFilter('residentId', undefined);
  }, [residentFilter, residents, residentsQuery.isSuccess, setFilter]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [CORRESPONDENCES_KEY] });
  }

  /**
   * As tres situacoes do destinatario, ditas por extenso.
   *
   * A listagem traz a unidade embutida, mas nao o morador, entao o nome sai da
   * colecao ja carregada para o seletor. Enquanto ela nao chegou, a celula usa o
   * placeholder neutro — anunciar "indisponivel" antes de ter procurado seria
   * falso.
   */
  function residentCell(row: Correspondence) {
    if (!row.residentId) return <span className="text-muted-foreground">{NO_RESIDENT}</span>;
    if (!residentsQuery.isSuccess) return '—';
    const resident = residentsById.get(row.residentId);
    if (!resident) return <span className="text-muted-foreground">{RESIDENT_UNAVAILABLE}</span>;
    return resident.name;
  }

  const columns: Column<Correspondence>[] = [
    {
      key: 'description',
      label: 'Descrição',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>
            {row.description ?? '—'}
          </span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type],
    },
    { key: 'carrier', label: 'Transportadora', sortable: true },
    { key: 'trackingCode', label: 'Rastreio', sortable: true },
    {
      // A listagem ja traz a unidade embutida; o acesso e protegido porque ela
      // pode ter sido removida depois do recebimento.
      key: 'unit',
      label: 'Unidade',
      render: (_value, row) =>
        row.unit ? (
          unitLabel(row.unit)
        ) : (
          <span className="text-muted-foreground">{UNIT_REMOVED}</span>
        ),
    },
    {
      key: 'residentId',
      label: 'Destinatário',
      render: (_value, row) => residentCell(row),
    },
    {
      // `receivedAt` e a ordem padrao do servidor, mas nao esta na whitelist de
      // ordenacao dele — filtravel mais buscavel mais os dois timestamps —,
      // entao a coluna nao se oferece para ordenar.
      key: 'receivedAt',
      label: 'Recebida em',
      render: (_value, row) => formatDateTime(row.receivedAt),
    },
    { key: 'receivedBy', label: 'Recebida por', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <CorrespondenceStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <CorrespondenceRowActions
          correspondence={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onDeliver={setDelivering}
          onEdit={(correspondence) =>
            setFormTarget({ correspondence, condominiumId: correspondence.condominiumId })
          }
          onDelete={setDeleting}
          onRestore={(correspondence) =>
            restore.mutate(correspondence.id, { onError: refreshOnRefusal })
          }
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  const pendingCount = pending.data ?? 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Correspondências" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condomínio"
              description="As correspondências sao listadas por condomínio. Escolha um no topo da tela para continuar."
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
              title="Correspondências"
              description={DESCRIPTION}
              actions={
                canCreate ? (
                  <Button
                    onClick={() =>
                      setFormTarget({ correspondence: null, condominiumId: selectedId })
                    }
                  >
                    Nova correspondência
                  </Button>
                ) : undefined
              }
            />

            {/*
              Uma interação so: o contador e o próprio atalho para a fila de
              retirada. Zero continua visível — a portaria vazia e informação, e
              some-la faria a ausência do número parecer falha de carregamento.
              O numero vem de `/correspondences/pending-count`, que conta pelo
              status no servidor, e não do total de uma listagem filtrada.
            */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={list.filters.status === 'PENDING' ? 'default' : 'outline'}
                size="sm"
                onClick={() => list.setFilter('status', 'PENDING')}
              >
                {/*
                  "Fila de retirada", e nao "Aguardando retirada": esse ja e o
                  rotulo do status na coluna, e o mesmo texto em duas coisas
                  diferentes da mesma tela as torna indistinguíveis.
                */}
                Fila de retirada
                <Badge variant="warning" className="ml-2">
                  {pending.isPending ? '—' : pendingCount}
                </Badge>
              </Button>
            </div>
          </div>
        }
        filters={<CorrespondenceFilters list={list} units={units} residents={residents} />}
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma correspondência corresponde aos termos e filtros aplicados."
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
                  icon={PackagePlus}
                  title="Nenhuma correspondência registrada"
                  description="Registre a primeira entrega recebida na portaria."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() =>
                          setFormTarget({ correspondence: null, condominiumId: selectedId })
                        }
                      >
                        Registrar correspondência
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
                emptyIcon={Inbox}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <CorrespondenceFormDialog
          key={formTarget.correspondence?.id ?? 'new'}
          correspondence={formTarget.correspondence ?? undefined}
          condominiumId={formTarget.condominiumId}
          units={units}
          residents={residents}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {delivering ? (
        <CorrespondenceDeliverDialog
          key={delivering.id}
          correspondence={delivering}
          onClose={() => setDelivering(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir correspondência?"
        description={
          deleting
            ? `${correspondenceLabel(deleting)} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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
