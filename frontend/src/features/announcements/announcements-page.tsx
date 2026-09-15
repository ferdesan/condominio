import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Megaphone, Pin, SearchX } from 'lucide-react';
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
import type { Announcement } from '@/types/announcement';
import {
  announcementFilters,
  announcementHooks,
  ANNOUNCEMENTS_KEY,
  useArchiveAnnouncement,
  useBlockOptions,
  usePublishAnnouncement,
} from './announcement-hooks';
import { AUDIENCE_LABELS, CATEGORY_LABELS, NO_AUTHOR } from './announcement-labels';
import { AnnouncementBoard } from './components/announcement-board';
import { AnnouncementFilters } from './components/announcement-filters';
import { AnnouncementFormDialog } from './components/announcement-form-dialog';
import { AnnouncementStatusBadge } from './components/announcement-status-badge';
import {
  AnnouncementRowActions,
  type AnnouncementLifecycleAction,
} from './components/announcement-row-actions';

const DESCRIPTION =
  'Os avisos da administracao: o que esta em rascunho, o que ja foi publicado e o que saiu do mural.';

/**
 * `announcement: null` cadastra; um registro edita. Ausente mantem o dialogo
 * fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { announcement: Announcement | null; condominiumId: string } | null;

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

export function AnnouncementsPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);
  /** Ids com uma acao do ciclo em voo, para que o segundo clique nao passe. */
  const inFlight = useRef(new Set<string>());

  const canCreate = can('announcement:create');
  const canUpdate = can('announcement:update');
  const canDelete = can('announcement:delete');

  const blocksQuery = useBlockOptions(selectedId);
  const blocks = useMemo(() => blocksQuery.data?.data ?? [], [blocksQuery.data]);

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(announcementFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = announcementHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = announcementHooks.useRemove();
  const restore = announcementHooks.useRestore();

  /**
   * A recusa de uma transicao descreve um estado que a tela ainda nao reflete —
   * outra pessoa publicou o rascunho enquanto esta lista estava aberta.
   * Atualizar a lista faz parte da resposta, junto da mensagem na linha.
   *
   * Definir `onError` aqui substitui o toast global do React Query v5, que e o
   * que se quer: a mensagem ja tem onde aparecer e nao deve aparecer duas vezes.
   */
  function handleLifecycleError(error: ApiError, variables: { id: string }): void {
    queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
    setRowError({ id: variables.id, message: error.message });
  }

  const lifecycleCallbacks = {
    onError: handleLifecycleError,
    onSuccess: () => setRowError(null),
  };
  const publish = usePublishAnnouncement(lifecycleCallbacks);
  const archive = useArchiveAnnouncement(lifecycleCallbacks);

  function runLifecycle(action: AnnouncementLifecycleAction, announcement: Announcement): void {
    // O `isPending` da mutacao so muda no proximo tick, entao dois cliques no
    // mesmo botao passariam os dois. O trinco fecha na hora, e e por linha para
    // que dois comunicados possam ser publicados em sequencia rapida.
    if (inFlight.current.has(announcement.id)) return;
    inFlight.current.add(announcement.id);
    setRowError(null);

    const mutation = action === 'publish' ? publish : archive;
    mutation.mutate(
      { id: announcement.id },
      { onSettled: () => inFlight.current.delete(announcement.id) },
    );
  }

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * Exclusao e restauracao nao passam `onError`, entao herdam o toast global —
   * que e a apresentacao certa para um 409 que traz so a mensagem. O que falta e
   * atualizar a lista: `onSuccess` nao roda quando a recusa chega, e tanto o 404
   * quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] });
  }

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      label: 'Titulo',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          {/*
            O alfinete diz a fixacao com forma propria, e o rotulo acessivel a
            diz por extenso: o destaque nao pode depender so de posicao ou cor.
          */}
          {row.pinned ? (
            <Pin className="size-3.5 shrink-0 text-primary" aria-label="Fixado" />
          ) : null}
          <span className={row.deletedAt ? 'line-through' : undefined}>{row.title}</span>
          {/* A tarja nomeia o estado: cor sozinha nao distingue removido de ativo. */}
          {row.deletedAt ? <Badge variant="destructive">Removido</Badge> : null}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoria',
      sortable: true,
      render: (_value, row) => CATEGORY_LABELS[row.category],
    },
    {
      key: 'audience',
      label: 'Publico',
      sortable: true,
      render: (_value, row) => AUDIENCE_LABELS[row.audience],
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => <AnnouncementStatusBadge status={row.status} />,
    },
    {
      // `publishedAt` e a ordem padrao do servidor, mas nao esta na whitelist de
      // ordenacao dele — filtravel mais buscavel mais os dois timestamps —,
      // entao a coluna nao se oferece para ordenar.
      key: 'publishedAt',
      label: 'Publicado em',
      render: (_value, row) => (row.publishedAt ? formatDateTime(row.publishedAt) : '—'),
    },
    {
      key: 'authorName',
      label: 'Autor',
      render: (_value, row) =>
        row.authorName ?? <span className="text-muted-foreground">{NO_AUTHOR}</span>,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <AnnouncementRowActions
          announcement={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          error={rowError?.id === row.id ? rowError.message : undefined}
          onLifecycle={runLifecycle}
          onEdit={(announcement) =>
            setFormTarget({ announcement, condominiumId: announcement.condominiumId })
          }
          onDelete={setDeleting}
          onRestore={(announcement) =>
            restore.mutate(announcement.id, { onError: refreshOnRefusal })
          }
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Comunicados" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os comunicados sao listados por condominio. Escolha um no topo da tela para continuar."
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
            title="Comunicados"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button
                  onClick={() => setFormTarget({ announcement: null, condominiumId: selectedId })}
                >
                  Novo comunicado
                </Button>
              ) : undefined
            }
          />
        }
        filters={
          <div className="space-y-4">
            {/*
              Acima dos filtros: "o que esta no ar agora" e a primeira pergunta
              de quem abre esta tela, e a listagem abaixo — com rascunhos,
              arquivados e expirados — nao a responde.
            */}
            <AnnouncementBoard condominiumId={selectedId} />
            <AnnouncementFilters list={list} />
          </div>
        }
        content={
          <div className="p-4 space-y-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum comunicado corresponde aos termos e filtros aplicados."
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
                  icon={Megaphone}
                  title="Nenhum comunicado registrado"
                  description="Escreva o primeiro aviso para os moradores deste condominio."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() =>
                          setFormTarget({ announcement: null, condominiumId: selectedId })
                        }
                      >
                        Redigir comunicado
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
                emptyIcon={Megaphone}
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <AnnouncementFormDialog
          key={formTarget.announcement?.id ?? 'new'}
          announcement={formTarget.announcement ?? undefined}
          condominiumId={formTarget.condominiumId}
          blocks={blocks}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir comunicado?"
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
