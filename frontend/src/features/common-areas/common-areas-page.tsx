import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, SearchX, Trees } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  commonAreaFilters,
  DEFAULT_PER_PAGE,
  pickFilters,
  useListState,
  type ListParams,
} from '@/lib/crud';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import type { CommonArea } from '@/types/api';
import { commonAreaHooks } from './common-area-hooks';
import { COMMON_AREA_STATUS_LABELS, weekdaysLabel } from './common-area-schema';
import { CommonAreaFilters } from './components/common-area-filters';
import { CommonAreaFormDialog } from './components/common-area-form-dialog';
import { CommonAreaRowActions } from './components/common-area-row-actions';

const STATUS_VARIANTS: Record<CommonArea['status'], 'success' | 'warning' | 'destructive'> = {
  AVAILABLE: 'success',
  MAINTENANCE: 'warning',
  BLOCKED: 'destructive',
};

/**
 * `area: null` cadastra; um registro edita. Ausente mantem o dialogo fechado.
 *
 * `condominiumId` e o do shell no momento em que o dialogo abriu, e nao o de
 * agora: trocar de condominio com o formulario aberto nao pode redirecionar o
 * envio para o predio recem-escolhido (US-027.EC-3).
 */
type FormTarget = { area: CommonArea | null; condominiumId: string } | null;

export function CommonAreasPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleting, setDeleting] = useState<CommonArea | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('common-area:create');
  const canUpdate = can('common-area:update');
  const canDelete = can('common-area:delete');

  /**
   * Todo pedido carrega o condominio do shell. `pickFilters` descarta o que
   * estiver fora da whitelist do servidor antes que vire uma query inocua.
   */
  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: {
        ...pickFilters(commonAreaFilters, base.filters ?? {}),
        condominiumId: selectedId ?? '',
      },
    };
  }, [list, selectedId]);

  const query = commonAreaHooks.useList(params, { enabled: Boolean(selectedId) });
  const remove = commonAreaHooks.useRemove();
  const restore = commonAreaHooks.useRestore();

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
    queryClient.invalidateQueries({ queryKey: ['common-areas'] });
  }

  /**
   * Colunas ordenaveis sao as que o repositorio aceita: filtravel + buscavel +
   * os dois timestamps. Capacidade, taxa e horarios nao estao na lista, e marcar
   * um cabecalho desses como ordenavel produziria um controle que o backend
   * descarta em silencio.
   */
  const columns: Column<CommonArea>[] = [
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
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_value, row) => (
        <Badge variant={STATUS_VARIANTS[row.status]}>{COMMON_AREA_STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacidade',
      // Zero nao e ausencia: significa que a area nao impoe limite de pessoas.
      render: (_value, row) => (row.capacity === 0 ? 'Sem limite' : String(row.capacity)),
    },
    {
      key: 'opensAt',
      label: 'Horario',
      render: (_value, row) => `${row.opensAt} - ${row.closesAt}`,
    },
    {
      key: 'availableWeekdays',
      label: 'Dias',
      render: (_value, row) => weekdaysLabel(row.availableWeekdays),
    },
    {
      key: 'requiresApproval',
      label: 'Aprovacao',
      sortable: true,
      render: (_value, row) =>
        row.requiresApproval ? (
          <Badge variant="warning">Exige aprovacao</Badge>
        ) : (
          <span className="text-muted-foreground">Reserva direta</span>
        ),
    },
    {
      key: 'reservationFee',
      label: 'Taxa',
      render: (_value, row) => formatCurrency(row.reservationFee),
    },
    // Sem `render`: a tabela ja troca nulo pelo placeholder neutro, e a coluna e
    // buscavel no servidor, entao vale mostrar o que a busca alcanca.
    { key: 'description', label: 'Descricao', sortable: true },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => (
        <CommonAreaRowActions
          area={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(area) => setFormTarget({ area, condominiumId: area.condominiumId })}
          onDelete={setDeleting}
          onRestore={(area) => restore.mutate(area.id, { onError: refreshOnRefusal })}
        />
      ),
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Áreas comuns" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condominio"
              description="As areas comuns pertencem a um condominio. Escolha um no topo da tela para continuar."
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
            title="Áreas comuns"
            description={DESCRIPTION}
            actions={
              canCreate ? (
                <Button onClick={() => setFormTarget({ area: null, condominiumId: selectedId })}>
                  Nova area comum
                </Button>
              ) : undefined
            }
          />
        }
        filters={<CommonAreaFilters list={list} />}
        content={
          <div className="p-4">
            {showEmpty ? (
              isNarrowed ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhum resultado para esta busca"
                  description="Nenhuma area comum corresponde aos termos e filtros aplicados."
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
                  icon={Trees}
                  title="Nenhuma area comum cadastrada"
                  description="Cadastre a primeira area para que os moradores possam reserva-la."
                  action={
                    canCreate ? (
                      <Button
                        onClick={() => setFormTarget({ area: null, condominiumId: selectedId })}
                      >
                        Cadastrar area comum
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
        // O condominio e o da abertura: trocar a selecao do shell com o
        // formulario aberto nao pode mudar para onde ele grava (US-027.EC-3).
        <CommonAreaFormDialog
          key={formTarget.area?.id ?? 'new'}
          area={formTarget.area ?? undefined}
          condominiumId={formTarget.condominiumId}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir area comum?"
        description={
          deleting
            ? `${deleting.name} deixara de aparecer na listagem e nao podera receber novas reservas. A exclusao e logica e pode ser desfeita.`
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

const DESCRIPTION =
  'Espacos reservaveis do condominio selecionado e as regras que governam as reservas.';
