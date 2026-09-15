import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, DoorOpen, SearchX, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime, formatDocument } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Visitor } from '@/types/visitor';
import {
  useCheckInVisitor,
  useCheckOutVisitor,
  useInsideCount,
  useUnitOptions,
  visitorFilters,
  visitorHooks,
  VISITORS_KEY,
} from './visitor-hooks';
import { TYPE_LABELS, UNIT_REMOVED, unitLabel } from './visitor-labels';
import { AccessCodeLookup } from './components/access-code-lookup';
import { VisitorFilters } from './components/visitor-filters';
import { VisitorFormDialog } from './components/visitor-form-dialog';
import { VisitorStatusBadge } from './components/visitor-status-badge';
import { VisitorRowActions, type VisitorFlowAction } from './components/visitor-row-actions';

const DESCRIPTION = 'Controle de acesso da portaria: quem chegou, quem esta dentro e quem saiu.';

/**
 * `visitor: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { visitor: Visitor | null; condominiumId: string } | null;

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

export function VisitorsPage() {
  const { can, user } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Visitor | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  /** Ids com uma acao de portaria em voo, para que o segundo clique nao passe. */
  const inFlight = useRef(new Set<string>());

  const canCreate = can('visitor:create');
  const canUpdate = can('visitor:update');
  const canDelete = can('visitor:delete');

  const unitsQuery = useUnitOptions(selectedId);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(visitorFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = visitorHooks.useList(params, { enabled: Boolean(selectedId) });
  const inside = useInsideCount(selectedId);
  const remove = visitorHooks.useRemove();
  const restore = visitorHooks.useRestore();

  /**
   * A recusa de uma acao de portaria descreve um estado que a tela ainda nao
   * reflete — outra pessoa registrou a entrada, ou a visita foi cancelada.
   * Atualizar a lista faz parte da resposta, junto da mensagem na linha.
   *
   * Definir `onError` aqui substitui o toast global do React Query v5, que e o
   * que se quer: a mensagem ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  function handleFlowError(error: ApiError, variables: { id: string }): void {
    queryClient.invalidateQueries({ queryKey: [VISITORS_KEY] });
    setRowError({ id: variables.id, message: error.message });
  }

  const flowCallbacks = {
    onError: handleFlowError,
    onSuccess: () => setRowError(null),
  };
  const checkIn = useCheckInVisitor(flowCallbacks);
  const checkOut = useCheckOutVisitor(flowCallbacks);

  function runFlow(action: VisitorFlowAction, visitor: Visitor): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por linha para
    // que duas chegadas simultaneas continuem podendo ser registradas.
    if (inFlight.current.has(visitor.id)) return;
    inFlight.current.add(visitor.id);
    setRowError(null);

    const mutation = action === 'check-in' ? checkIn : checkOut;
    mutation.mutate({ id: visitor.id }, { onSettled: () => inFlight.current.delete(visitor.id) });
  }

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage, setFilter } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  // Unidades nao atravessam condominios: trocar a selecao do shell torna
  // inexistente aqui o filtro de unidade, e mante-lo devolveria lista vazia sem
  // explicar por que.
  const previousCondominium = useRef(selectedId);
  useEffect(() => {
    if (previousCondominium.current === selectedId) return;
    previousCondominium.current = selectedId;
    setFilter('unitId', undefined);
  }, [selectedId, setFilter]);

  // A unidade filtrada pode ter sido removida enquanto o filtro seguia ativo.
  const unitFilter = list.filters.unitId;
  useEffect(() => {
    if (typeof unitFilter !== 'string' || unitFilter === '') return;
    if (!unitsQuery.isSuccess) return;
    if (units.some((unit) => unit.id === unitFilter)) return;
    setFilter('unitId', undefined);
  }, [unitFilter, units, unitsQuery.isSuccess, setFilter]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [VISITORS_KEY] });
  }

  const columns: Column<Visitor>[] = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.name}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    {
      key: 'document',
      label: 'Documento',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type],
    },
    { key: 'company', label: 'Empresa', sortable: true },
    {
      // A listagem ja traz a unidade embutida; o acesso e protegido porque ela
      // pode ter sido removida depois do registro da visita.
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
      // "Previsto para", e nao "Previsto": o rotulo do status `EXPECTED` ja e
      // "Previsto", e duas coisas diferentes com o mesmo nome na mesma tabela
      // sao indistinguiveis para quem le por cabecalho.
      key: 'expectedAt',
      label: 'Previsto para',
      render: (_value, row) => formatDateTime(row.expectedAt),
    },
    {
      key: 'checkedInAt',
      label: 'Entrada',
      render: (_value, row) => formatDateTime(row.checkedInAt),
    },
    { key: 'badgeNumber', label: 'Cracha', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <VisitorStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <VisitorRowActions
          visitor={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onFlow={runFlow}
          onEdit={(visitor) => setFormTarget({ visitor, condominiumId: visitor.condominiumId })}
          onDelete={setDeleting}
          onRestore={(visitor) => restore.mutate(visitor.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  const insideCount = inside.data ?? 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Visitantes" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os visitantes sao listados por condominio. Escolha um no topo da tela para continuar."
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
              title="Visitantes"
              description={DESCRIPTION}
              actions={
                canCreate ? (
                  <Button
                    onClick={() => setFormTarget({ visitor: null, condominiumId: selectedId })}
                  >
                    Novo visitante
                  </Button>
                ) : undefined
              }
            />

            {/*
              Uma interacao so: o contador e o proprio atalho para quem esta
              dentro. Zero continua visivel — o condominio vazio e informacao.
              O numero vem de `/visitors/inside-count`, que conta pelo status no
              servidor, e nao do total de uma listagem filtrada.
            */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={list.filters.status === 'CHECKED_IN' ? 'default' : 'outline'}
                size="sm"
                onClick={() => list.setFilter('status', 'CHECKED_IN')}
              >
                Dentro agora
                <Badge variant="success" className="ml-2">
                  {inside.isPending ? '—' : insideCount}
                </Badge>
              </Button>
            </div>
          </div>
        }
        filters={
          <div className="space-y-4">
            {/*
              Acima dos filtros de proposito: o balcao vem antes da consulta a
              lista. Quem esta com alguem parado na frente pergunta por um
              codigo, e nao refina uma listagem.
            */}
            <AccessCodeLookup
              canCheckIn={canUpdate}
              onCheckIn={(visitor) => runFlow('check-in', visitor)}
            />
            <VisitorFilters list={list} units={units} currentUserId={user?.id ?? null} />
          </div>
        }
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum visitante corresponde aos termos e filtros aplicados."
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
                  icon={UserPlus}
                  title="Nenhum visitante registrado"
                  description="Registre a primeira visita para acompanhar quem entra e quem sai."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ visitor: null, condominiumId: selectedId })}
                      >
                        Registrar visitante
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
                emptyIcon={DoorOpen}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <VisitorFormDialog
          key={formTarget.visitor?.id ?? 'new'}
          visitor={formTarget.visitor ?? undefined}
          condominiumId={formTarget.condominiumId}
          units={units}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir visitante?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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
