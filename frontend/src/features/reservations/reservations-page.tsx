import { useEffect, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { CalendarPlus, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, MAX_PER_PAGE, useListState } from '@/lib/crud';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Reservation } from '@/types/api';
import { monthRange } from './calendar-grid';
import {
  commonAreaHooks,
  reservationHooks,
  unitHooks,
  useAvailability,
  useReservationCount,
} from './reservation-hooks';
import { ReservationCalendar } from './components/reservation-calendar';
import { ReservationFilters } from './components/reservation-filters';
import { ReservationFormDialog } from './components/reservation-form-dialog';
import { ReservationIndicators } from './components/reservation-indicators';
import {
  ReservationRowActions,
  type ReservationAction,
} from './components/reservation-row-actions';
import { ReservationDecisionDialog } from './components/reservation-decision-dialog';
import { ReservationStatusBadge } from './components/reservation-status-badge';

type View = 'list' | 'calendar';
type DecisionTarget = { action: ReservationAction; reservation: Reservation } | null;

/** As colecoes auxiliares cabem numa pagina so; nao ha paginacao a oferecer. */
const OPTIONS_PER_PAGE = MAX_PER_PAGE;

export function ReservationsPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const list = useListState();
  const [view, setView] = useState<View>('list');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [calendarAreaId, setCalendarAreaId] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [decision, setDecision] = useState<DecisionTarget>(null);

  const canCreate = can('reservation:create');
  const canManage = can('reservation:manage');
  const canUpdate = can('reservation:update');

  const { setFilter } = list;

  // Trocar de condominio recarrega a lista e limpa area e unidade: os valores
  // do condominio anterior nao existem no novo, e um filtro por um id que nao
  // pertence a este condominio devolveria uma lista vazia sem explicar por que.
  useEffect(() => {
    setFilter('commonAreaId', undefined);
    setFilter('unitId', undefined);
    setCalendarAreaId(undefined);
  }, [selectedId, setFilter]);

  const scoped = selectedId ? { condominiumId: selectedId } : {};
  const optionsEnabled = Boolean(selectedId);

  const areasQuery = commonAreaHooks.useList(
    { page: 1, perPage: OPTIONS_PER_PAGE, filters: scoped },
    { enabled: optionsEnabled },
  );
  const unitsQuery = unitHooks.useList(
    { page: 1, perPage: OPTIONS_PER_PAGE, filters: scoped },
    { enabled: optionsEnabled },
  );

  const areas = areasQuery.data?.data ?? [];
  const units = unitsQuery.data?.data ?? [];
  /** Uma area em manutencao ou bloqueada nao pode ser reservada: some do seletor. */
  const bookableAreas = areas.filter((area) => area.status === 'AVAILABLE');

  const listParams = list.toListParams(DEFAULT_PER_PAGE);
  const query = reservationHooks.useList(
    { ...listParams, filters: { ...listParams.filters, ...scoped } },
    { enabled: optionsEnabled },
  );

  const pending = useReservationCount(
    { ...scoped, status: 'PENDING' },
    { enabled: optionsEnabled },
  );

  const { from, to } = monthRange(month);
  const availability = useAvailability(
    selectedId ? { condominiumId: selectedId, from, to, commonAreaId: calendarAreaId } : null,
  );

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de filtrar a partir de uma pagina alta.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  const columns: Column<Reservation>[] = [
    {
      key: 'commonAreaId',
      label: 'Area comum',
      render: (_value, row) => (
        // A area pode ter sido removida depois da reserva; a linha continua
        // legivel porque o resto dela nao depende desse registro.
        <span className={row.commonArea ? undefined : 'text-muted-foreground'}>
          {row.commonArea?.name ?? 'Area indisponivel'}
        </span>
      ),
    },
    {
      key: 'unitId',
      label: 'Unidade',
      render: (_value, row) =>
        row.unit ? `Unidade ${row.unit.number}` : <span className="text-muted-foreground">Unidade indisponivel</span>,
    },
    // O nome do solicitante e gravado na propria reserva, entao sobrevive a
    // remocao da unidade e do usuario.
    { key: 'requestedByName', label: 'Solicitante', sortable: true },
    {
      key: 'startsAt',
      label: 'Inicio',
      render: (_value, row) => formatDateTime(row.startsAt),
    },
    {
      key: 'endsAt',
      label: 'Termino',
      render: (_value, row) => formatDateTime(row.endsAt),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <div className="space-y-1">
          <ReservationStatusBadge status={row.status} />
          {row.statusReason ? (
            <p className="text-xs text-muted-foreground">Motivo: {row.statusReason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'fee',
      label: 'Taxa',
      render: (_value, row) => formatCurrency(row.fee),
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <ReservationRowActions
          reservation={row}
          canManage={canManage}
          canUpdate={canUpdate}
          onAct={(action, reservation) => setDecision({ action, reservation })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  const pendingCount = pending.data ?? 0;

  return (
    <>
      <CrudLayout
        header={
          <div className="space-y-4">
            <PageHeader
              title="Reservas"
              description="Agenda das areas comuns, com fila de aprovacao e calendario do mes."
              actions={
                canCreate && selectedId ? (
                  <Button onClick={() => setCreating(true)}>Nova reserva</Button>
                ) : undefined
              }
            />

            <div className="flex flex-wrap items-center gap-3">
              {/*
                Uma interacao so: o contador e o proprio atalho para a fila.
                Zero continua visivel — a ausencia de pendencias e informacao.
              */}
              <Button
                variant={list.filters.status === 'PENDING' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setView('list');
                  list.setFilter('status', 'PENDING');
                }}
              >
                Aguardando decisao
                <Badge variant="warning" className="ml-2">
                  {pending.isPending ? '—' : pendingCount}
                </Badge>
              </Button>

              <div className="flex items-center gap-1" role="group" aria-label="Visualizacao">
                <Button
                  variant={view === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                >
                  Lista
                </Button>
                <Button
                  variant={view === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  aria-pressed={view === 'calendar'}
                  onClick={() => setView('calendar')}
                >
                  Calendario
                </Button>
              </div>
            </div>

            <ReservationIndicators condominiumId={selectedId} month={month} areas={areas} />
          </div>
        }
        filters={
          view === 'list' ? (
            <ReservationFilters list={list} areas={areas} units={units} />
          ) : undefined
        }
        content={
          view === 'calendar' ? (
            <ReservationCalendar
              month={month}
              onMonthChange={setMonth}
              entries={availability.data ?? []}
              loading={availability.isPending && Boolean(selectedId)}
              areas={areas}
              areaId={calendarAreaId}
              onAreaChange={setCalendarAreaId}
              hasCondominium={Boolean(selectedId)}
            />
          ) : !selectedId ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarPlus}
                title="Selecione um condominio"
                description="As reservas sao listadas por condominio. Escolha um no seletor do topo."
              />
            </div>
          ) : showEmpty ? (
            <div className="p-4">
              {isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma reserva corresponde aos termos e filtros aplicados."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        list.setSearch('');
                        list.setFilter('commonAreaId', undefined);
                        list.setFilter('status', undefined);
                        list.setFilter('unitId', undefined);
                      }}
                    >
                      Limpar busca
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CalendarPlus}
                  title="Nenhuma reserva registrada"
                  description="Registre a primeira reserva de uma area comum deste condominio."
                  action={
                    canCreate ? (
                      <Button onClick={() => setCreating(true)}>Nova reserva</Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : (
            <div className="p-4">
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
              />
            </div>
          )
        }
      />

      {creating && selectedId ? (
        <ReservationFormDialog
          condominiumId={selectedId}
          areas={bookableAreas}
          units={units}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {decision ? (
        <ReservationDecisionDialog
          key={`${decision.action}-${decision.reservation.id}`}
          action={decision.action}
          reservation={decision.reservation}
          onClose={() => setDecision(null)}
        />
      ) : null}
    </>
  );
}
