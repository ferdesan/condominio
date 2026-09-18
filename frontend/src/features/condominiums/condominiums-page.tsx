import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_PER_PAGE, useListState } from '@/lib/crud';
import { formatDocument } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import type { Condominium } from '@/types/api';
import { condominiumHooks } from './condominium-hooks';
import { CondominiumFilters } from './components/condominium-filters';
import { CondominiumFormDialog } from './components/condominium-form-dialog';
import { CondominiumRowActions } from './components/condominium-row-actions';

const STATUS_LABELS: Record<Condominium['status'], string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

/** `null` cadastra; um registro edita. Ausente mantem o dialogo fechado. */
type FormTarget = { condominium: Condominium | null } | null;

export function CondominiumsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Condominium | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('condominium:create');
  const canUpdate = can('condominium:update');
  const canDelete = can('condominium:delete');

  const query = condominiumHooks.useList(list.toListParams(DEFAULT_PER_PAGE));
  const remove = condominiumHooks.useRemove();
  const restore = condominiumHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * As acoes de linha nao passam `onError`, entao herdam o toast global — que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor. O que
   * falta e atualizar a lista: `onSuccess` nao roda quando a recusa chega, e
   * tanto o 404 quanto o 409 descrevem um estado que a tela ainda nao reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: ['condominiums'] });
  }

  const columns: Column<Condominium>[] = [
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
      label: 'CNPJ',
      sortable: true,
      render: (_value, row) => formatDocument(row.document),
    },
    // `syndicName` nao esta na whitelist de ordenacao do servidor: oferecer o
    // controle produziria um cabecalho que nao faz nada.
    { key: 'syndicName', label: 'Síndico' },
    { key: 'city', label: 'Cidade', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => (
        <CondominiumRowActions
          condominium={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(condominium) => setFormTarget({ condominium })}
          onDelete={setDeleting}
          onRestore={(condominium) => restore.mutate(condominium.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  return (
    <>
      <CrudLayout
        header={
          <PageHeader
            title="Condomínios"
            description="Cadastro dos condomínios geridos pela sua conta."
            actions={
              canCreate ? (
                <Button onClick={() => setFormTarget({ condominium: null })}>
                  Novo condomínio
                </Button>
              ) : undefined
            }
          />
        }
        filters={<CondominiumFilters list={list} />}
        content={
          showEmpty ? (
            <div className="p-4">
              {isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum condomínio corresponde aos termos e filtros aplicados."
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
                  icon={Building2}
                  title="Nenhum condomínio cadastrado"
                  description="Cadastre o primeiro condomínio para comecar a registrar unidades e moradores."
                  action={
                    canCreate ? (
                      <Button onClick={() => setFormTarget({ condominium: null })}>
                        Cadastrar condomínio
                      </Button>
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
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            </div>
          )
        }
      />

      {formTarget ? (
        <CondominiumFormDialog
          key={formTarget.condominium?.id ?? 'new'}
          condominium={formTarget.condominium ?? undefined}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir condomínio?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer nas listagens e no seletor. A exclusao e logica e pode ser desfeita.`
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
