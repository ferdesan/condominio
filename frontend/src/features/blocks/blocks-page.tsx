import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Layers, SearchX } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  blockFilters,
  DEFAULT_PER_PAGE,
  pickFilters,
  useListState,
  type ListParams,
} from '@/lib/crud';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { Block } from '@/types/api';
import { BLOCKS_KEY, blockHooks } from './block-hooks';
import { BLOCK_TYPE_LABELS } from './block-schema';
import { BlockFilters } from './components/block-filters';
import { BlockFormDialog } from './components/block-form-dialog';
import { BlockRowActions } from './components/block-row-actions';

/**
 * `block: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { block: Block | null; condominiumId: string } | null;

/**
 * Tela de blocos.
 *
 * A gestao de blocos ja existia embutida no cadastro de unidades, porque uma
 * unidade nao existe sem um bloco e nao havia outra tela que os criasse
 * (ADR-007). Esta rota nao a substitui: as duas leem os mesmos hooks e abrem o
 * mesmo `BlockFormDialog`, e o que muda e so o ponto de entrada — aqui uma
 * listagem completa, la um dialogo enxuto no meio do cadastro de unidades.
 */
export function BlocksPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('block:create');
  const canUpdate = can('block:update');
  const canDelete = can('block:delete');

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(blockFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = blockHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = blockHooks.useRemove();
  const restore = blockHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  // Uma pagina alem da ultima volta para a ultima valida em vez de renderizar
  // vazio — o que acontece depois de remover os ultimos registros de uma pagina.
  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  /**
   * A acao de linha nao passa `onError`: ela herda o toast global, que e a
   * apresentacao certa para um 409 que traz so a mensagem do servidor — e a
   * recusa de excluir um bloco com unidades e exatamente isso. O que falta e
   * recarregar a lista, porque a recusa descreve um estado que a tela ainda nao
   * reflete.
   */
  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
  }

  /**
   * Colunas ordenaveis sao as que o repositorio aceita: filtravel + buscavel +
   * os dois timestamps. Andares e unidades por andar nao estao na lista, e
   * marcar um cabecalho desses como ordenavel produziria um controle que o
   * backend descarta em silencio.
   */
  const columns: Column<Block>[] = [
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
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (_value, row) => BLOCK_TYPE_LABELS[row.type],
    },
    { key: 'floors', label: 'Andares' },
    { key: 'unitsPerFloor', label: 'Unidades por andar' },
    {
      key: 'hasElevator',
      label: 'Elevador',
      render: (_value, row) =>
        row.hasElevator ? (
          <Badge variant="neutral">Com elevador</Badge>
        ) : (
          <span className="text-muted-foreground">Sem elevador</span>
        ),
    },
    {
      key: 'description',
      label: 'Descricao',
      sortable: true,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <BlockRowActions
          block={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(block) => setFormTarget({ block, condominiumId: block.condominiumId })}
          onDelete={setDeleting}
          onRestore={(block) => restore.mutate(block.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Blocos" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="Os blocos pertencem a um condominio. Escolha um no topo da tela para continuar."
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
            title="Blocos"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button onClick={() => setFormTarget({ block: null, condominiumId: selectedId })}>
                  Novo bloco
                </Button>
              ) : undefined
            }
          />
        }
        filters={<BlockFilters list={list} />}
        content={
          <div className="p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhum bloco corresponde aos termos e filtros aplicados."
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
                  icon={Layers}
                  title="Nenhum bloco cadastrado"
                  description="Cadastre o primeiro bloco para poder registrar ou gerar unidades."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ block: null, condominiumId: selectedId })}
                      >
                        Cadastrar bloco
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
                rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
              />
            )}
          </div>
        }
      />

      {formTarget ? (
        // O mesmo dialogo que a gestao embutida em Unidades abre (ADR-007); o
        // condominio e o da abertura, para que trocar a selecao do shell nao
        // mude para onde ele grava (US-027.EC-3).
        <BlockFormDialog
          key={formTarget.block?.id ?? 'new'}
          condominiumId={formTarget.condominiumId}
          block={formTarget.block ?? undefined}
          onSaved={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir bloco?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e nos seletores de unidade. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION = 'Blocos, torres, alas e ruas do condominio selecionado.';
