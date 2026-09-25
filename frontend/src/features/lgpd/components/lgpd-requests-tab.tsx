import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEFAULT_PER_PAGE,
  lgpdRequestFilters,
  pickFilters,
  useListState,
  type ListParams,
} from '@/lib/crud';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { CreateDeleteRequestResult, LgpdRequestView } from '@/types/lgpd';
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_VARIANTS } from '../lgpd-labels';
import {
  useCancelDeleteRequest,
  useCreateDeleteRequest,
  useDeleteRequests,
  useExecuteDeleteRequest,
} from '../lgpd-hooks';

/**
 * A aba padrao da pagina LGPD.
 *
 * Quem gerencia (`lgpd-request:manage`) ve a fila de pedidos e decide cada um; o
 * morador, que so tem `lgpd-request:create`, nao tem como listar pedidos — sem
 * `lgpd-request:read` o servidor recusa a listagem — e a aba para ele e a
 * superficie de criacao do proprio pedido (ADR-005).
 */
export function LgpdRequestsTab() {
  const { can } = useAuth();
  if (!can('lgpd-request:manage')) return <ResidentRequestsPanel />;
  return <AdminRequestsList />;
}

function AdminRequestsList() {
  const { selected, selectedId } = useCondominium();
  const list = useListState();
  const [executing, setExecuting] = useState<LgpdRequestView | null>(null);
  const [cancelling, setCancelling] = useState<LgpdRequestView | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
  // mesmo pedido passariam os dois. O trinco fecha na hora.
  function withBusyGuard(action: () => void): void {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    action();
  }

  function releaseBusy(): void {
    busyRef.current = false;
    setBusy(false);
    setExecuting(null);
    setCancelling(null);
  }

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(lgpdRequestFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = useDeleteRequests(params, { enabled: Boolean(selectedId) });
  const execute = useExecuteDeleteRequest();
  const cancel = useCancelDeleteRequest();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de executar os ultimos pedidos de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  if (!selectedId) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecione um condomínio"
        description="Os pedidos de anonimização sao listados por condomínio. Escolha um no topo da tela para continuar."
      />
    );
  }

  const columns: Column<LgpdRequestView>[] = [
    { key: 'residentName', label: 'Morador', render: (_value, row) => row.residentName },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={REQUEST_STATUS_VARIANTS[row.status]}>
          {REQUEST_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'requestedAt',
      label: 'Solicitada em',
      render: (_value, row) => formatDateTime(row.requestedAt),
    },
    {
      key: 'executedAt',
      label: 'Executada em',
      render: (_value, row) => formatDateTime(row.executedAt),
    },
    {
      key: 'cancelledAt',
      label: 'Cancelada em',
      render: (_value, row) => formatDateTime(row.cancelledAt),
    },
    { key: 'notes', label: 'Anotações', render: (_value, row) => row.notes ?? '—' },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) =>
        row.status === 'PENDING' ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              aria-label={`Executar solicitação de ${row.residentName}`}
              onClick={() => setExecuting(row)}
            >
              Executar
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Cancelar solicitação de ${row.residentName}`}
              onClick={() => setCancelling(row)}
            >
              Cancelar
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pedidos de anonimizacao de dados do {selected?.name ?? 'condomínio selecionado'}.
      </p>

      <DataTable
        columns={columns}
        data={rows}
        idKey="id"
        loading={query.isPending}
        searchable={false}
        sort={list.sort}
        onSort={list.setSort}
        pageable
        pageSize={DEFAULT_PER_PAGE}
        currentPage={page}
        totalPages={totalPages ?? 1}
        onPageChange={setPage}
        emptyTitle="Nenhuma solicitação"
        emptyDescription="Os pedidos de exclusao de dados aparecerao aqui."
      />

      <ConfirmDialog
        open={executing !== null}
        title="Executar anonimização?"
        description={
          executing
            ? `Os dados pessoais de ${executing.residentName} serão anonimizados e o seu acesso ao sistema, encerrado. Esta ação e irreversível e fica registrada na auditoria.`
            : undefined
        }
        actionLabel="Executar"
        loading={busy}
        onCancel={() => setExecuting(null)}
        onConfirm={() => {
          if (!executing) return;
          withBusyGuard(() =>
            execute.mutate(executing.id, {
              onSuccess: () => toast.success('Anonimização executada.'),
              onSettled: releaseBusy,
            }),
          );
        }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar solicitação?"
        description={
          cancelling
            ? `O pedido de ${cancelling.residentName} não será executado e o morador podera faze-lo novamente.`
            : undefined
        }
        actionLabel="Cancelar solicitação"
        variant="warning"
        loading={busy}
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          if (!cancelling) return;
          withBusyGuard(() =>
            cancel.mutate(cancelling.id, {
              onSuccess: () => toast.success('Solicitação cancelada.'),
              onSettled: releaseBusy,
            }),
          );
        }}
      />
    </div>
  );
}

function ResidentRequestsPanel() {
  const { selectedId } = useCondominium();
  const create = useCreateDeleteRequest();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [created, setCreated] = useState<CreateDeleteRequestResult | null>(null);

  function submit(): void {
    if (!selectedId || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    create.mutate(
      { condominiumId: selectedId },
      {
        onSuccess: (result) => {
          setCreated(result);
          setOpen(false);
          toast.success('Solicitação de exclusao enviada.');
          // O servidor avisa o que sera preservado e o que deixa de funcionar.
          for (const warning of result.warnings) toast.message(warning);
        },
        onSettled: () => {
          sendingRef.current = false;
          setSending(false);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Exclusao dos seus dados</CardTitle>
          <CardDescription>
            Solicite a anonimização dos seus dados pessoais, conforme a LGPD (Art. 18, VI).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {created ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>{REQUEST_STATUS_LABELS[created.status]}</Badge>
                <p className="text-sm text-muted-foreground">
                  Seu pedido foi registrado e será apreciado pela administração.
                </p>
              </div>
            </div>
          ) : (
            <Button onClick={() => setOpen(true)}>Solicitar exclusao de dados</Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={open}
        title="Solicitar exclusao de dados?"
        variant="danger"
        description="Seus dados pessoais serão anonimizados e o acesso a plataforma, encerrado. Cobranças, reservas e documentos já emitidos sao preservados por obrigação legal."
        actionLabel="Enviar solicitação"
        loading={sending}
        onCancel={() => setOpen(false)}
        onConfirm={submit}
      />
    </div>
  );
}
