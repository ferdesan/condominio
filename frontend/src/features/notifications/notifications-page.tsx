import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { AppNotification } from '@/types/notification';
import {
  notificationFilters,
  NOTIFICATIONS_KEY,
  useMarkAsRead,
  useNotificationList,
  useUnreadCount,
} from './notification-hooks';
import { TYPE_LABELS } from './notification-labels';
import { NotificationFilters } from './components/notification-filters';
import { NotificationReadBadge } from './components/notification-read-badge';
import { NotificationRowActions } from './components/notification-row-actions';
import { NotificationSummary } from './components/notification-summary';

const DESCRIPTION =
  'O que o sistema avisou a você. A central e pessoal: ninguem mais ve esta lista, e ela não muda com o condomínio selecionado.';

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

/**
 * Central de notificacoes.
 *
 * **Somente leitura mais a marcacao de leitura.** Nao ha criar, editar, excluir
 * nem restaurar aqui porque nao ha no servidor: as notificacoes sao geradas por
 * eventos de negocio, e `notification.routes.ts` expoe duas leituras e uma
 * escrita, que apenas registra a leitura.
 *
 * **Nao segue o condominio do shell.** As notificacoes do tenant inteiro tem
 * `condominiumId` nulo, entao recortar por condominio esconderia justamente as
 * que valem para todos. A lista e da pessoa, e nao do predio.
 *
 * O socket continua fora de escopo: o backend emite `notification:new` em tempo
 * real, mas esta tela nao o escuta — a lista e a contagem sao atualizadas pela
 * invalidacao da mutacao, como nas demais.
 */
export function NotificationsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [rowError, setRowError] = useState<RowError>(null);
  const inFlight = useRef(new Set<string>());
  const markingAll = useRef(false);

  const canUpdate = can('notification:update');

  /**
   * `pickFilters` descarta o que estiver fora da whitelist do servidor antes que
   * vire uma query inocua — e a whitelist desta tela exclui de proposito o
   * destinatario e o condominio, que o servidor trata a seu modo.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return { ...base, filters: pickFilters(notificationFilters, base.filters ?? {}) };
  }, [list]);

  const query = useNotificationList(params);
  const unread = useUnreadCount();

  /**
   * A recusa descreve algo sobre esta notificacao. Definir `onError` aqui
   * substitui o toast global do React Query v5, que e o que se quer: a mensagem
   * ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  const markAsRead = useMarkAsRead({
    onError: (error: ApiError, variables) => {
      // A recusa descreve um estado que a tela ainda nao reflete — a notificacao
      // pode ter sido lida em outra aba.
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
      const id = variables.ids?.[0];
      if (id) setRowError({ id, message: error.message });
    },
    onSuccess: () => setRowError(null),
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece quando um filtro encolhe o resultado.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function markOne(notification: AppNotification): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por linha para
    // que duas notificacoes possam ser marcadas em sequencia rapida.
    if (inFlight.current.has(notification.id)) return;
    inFlight.current.add(notification.id);
    setRowError(null);

    markAsRead.mutate(
      { ids: [notification.id] },
      { onSettled: () => inFlight.current.delete(notification.id) },
    );
  }

  /** Corpo sem `ids`: o servidor marca todas as nao lidas do usuario de uma vez. */
  function markAll(): void {
    if (markingAll.current) return;
    markingAll.current = true;
    setRowError(null);

    markAsRead.mutate(
      {},
      {
        onSettled: () => {
          markingAll.current = false;
        },
      },
    );
  }

  const columns: Column<AppNotification>[] = [
    {
      key: 'createdAt',
      label: 'Recebida',
      sortable: true,
      render: (_value, row) => (
        <div className="whitespace-nowrap">
          <p>{formatDateTime(row.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{formatRelative(row.createdAt)}</p>
        </div>
      ),
    },
    {
      // Nao ordenavel: `readAt` nao esta no conjunto ordenavel do servidor — a
      // chave seria descartada em silencio e a ordem voltaria para a padrao.
      key: 'readAt',
      label: 'Situação',
      render: (_value, row) => <NotificationReadBadge readAt={row.readAt} />,
    },
    {
      key: 'title',
      label: 'Assunto',
      sortable: true,
      // O peso reforca o que a tarja ja diz; sozinho ele nao distinguiria nada.
      render: (_value, row) => (
        <span className={row.readAt ? undefined : 'font-semibold'}>{row.title}</span>
      ),
    },
    {
      key: 'message',
      label: 'Mensagem',
      sortable: true,
      render: (_value, row) => <span className="text-muted-foreground">{row.message}</span>,
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => TYPE_LABELS[row.type] ?? row.type,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <NotificationRowActions
          notification={row}
          canUpdate={canUpdate}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onMarkAsRead={markOne}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;
  const hasUnread = (unread.data ?? 0) > 0;

  return (
    <CrudLayout
      header={
        <PageHeader
          title="Notificações"
          description={DESCRIPTION}
          actions={
            canUpdate ? (
              <Button variant="outline" disabled={!hasUnread} onClick={markAll}>
                Marcar todas como lidas
              </Button>
            ) : undefined
          }
        />
      }
      filters={
        <div className="space-y-4">
          <NotificationSummary
            count={unread.data}
            isPending={unread.isPending}
            isError={unread.isError}
          />
          <NotificationFilters list={list} />
        </div>
      }
      content={
        <div className="space-y-4 p-4">
          {showEmpty ? (
            isNarrowed ? (
              <EmptyState
                icon={SearchX}
                title="Nenhum resultado para esta busca"
                description="Nenhuma notificação corresponde aos termos e filtros aplicados."
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
                icon={BellOff}
                title="Nenhuma notificação até agora"
                description="Reservas, correspondências e ocorrências avisam você por aqui assim que acontecerem."
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
              emptyIcon={BellOff}
              rowClassName={(row) => (row.readAt ? '' : 'bg-primary/5')}
            />
          )}
        </div>
      }
    />
  );
}
