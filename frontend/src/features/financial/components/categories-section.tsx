import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, RotateCcw, Search, SearchX, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FilterPanel, type Filter } from '@/components/common/filter-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowAction, RowActions } from '@/components/ui/row-actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_PER_PAGE, pickFilters, useListState, type ListParams } from '@/lib/crud';
import { useAuth } from '@/hooks/use-auth';
import { CATEGORY_KINDS, type FinancialCategory } from '@/types/financial';
import { categoryFilters, categoryHooks, CATEGORIES_KEY } from '../financial-hooks';
import { CATEGORY_KIND_LABELS, categoryLabel } from '../financial-labels';
import { CategoryFormDialog } from './category-form-dialog';

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

const KIND_OPTIONS = CATEGORY_KINDS.map((value) => ({
  value,
  label: CATEGORY_KIND_LABELS[value],
}));

export interface CategoriesSectionProps {
  condominiumId: string;
}

/**
 * Plano de contas do condominio.
 *
 * E a secao mais simples das tres: CRUD puro, sem acao de fluxo. Uma conta
 * inativa continua no historico — e por isso "ativa" e um campo, e nao uma
 * exclusao: apagar a conta de uma despesa de tres anos atras apagaria a
 * classificacao dela na prestacao de contas.
 */
export function CategoriesSection({ condominiumId }: CategoriesSectionProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<FinancialCategory | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<FinancialCategory | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('financial-category:create');
  const canUpdate = can('financial-category:update');
  const canDelete = can('financial-category:delete');

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: pickFilters(categoryFilters, { ...base.filters, condominiumId }),
    };
  }, [list, condominiumId]);

  const query = categoryHooks.useList(params);
  const remove = categoryHooks.useRemove();
  const restore = categoryHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
  }

  const chips: Filter[] = [];
  if (list.filters.kind) {
    chips.push({
      id: 'kind',
      label: 'Natureza',
      value: CATEGORY_KIND_LABELS[list.filters.kind as keyof typeof CATEGORY_KIND_LABELS],
    });
  }

  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  const columns: Column<FinancialCategory>[] = [
    {
      key: 'name',
      label: 'Conta',
      sortable: true,
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <span className={row.deletedAt ? 'line-through' : 'font-medium'}>{row.name}</span>
          {row.deletedAt ? <Badge variant="destructive">Removida</Badge> : null}
          {/* A tarja nomeia o estado: uma conta inativa some dos seletores mas
              continua classificando o historico. */}
          {!row.active && !row.deletedAt ? <Badge variant="neutral">Inativa</Badge> : null}
        </div>
      ),
    },
    {
      key: 'kind',
      label: 'Natureza',
      sortable: true,
      render: (_value, row) => CATEGORY_KIND_LABELS[row.kind],
    },
    { key: 'code', label: 'Código', sortable: true },
    { key: 'description', label: 'Descrição', sortable: true },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => {
        const label = categoryLabel(row);

        if (row.deletedAt) {
          if (!canUpdate) return null;
          return (
            <RowActions>
              <RowAction
                icon={RotateCcw}
                label={`Restaurar ${label}`}
                onClick={() => restore.mutate(row.id, { onError: refreshOnRefusal })}
              />
            </RowActions>
          );
        }

        return (
          <RowActions>
            {canUpdate ? (
              <RowAction
                icon={Pencil}
                label={`Editar ${label}`}
                onClick={() => setFormTarget(row)}
              />
            ) : null}

            {canDelete ? (
              <RowAction
                icon={Trash2}
                tone="destructive"
                label={`Excluir ${label}`}
                onClick={() => setDeleting(row)}
              />
            ) : null}
          </RowActions>
        );
      },
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  return (
    <div className="space-y-4">
      <FilterPanel filters={chips} onFilterChange={handleChipChange} onClear={list.clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="category-search">Buscar</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="category-search"
                className="pl-10"
                placeholder="Nome, código ou descrição"
                value={list.searchInput}
                onChange={(event) => list.setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-kind-filter">Natureza</Label>
            <Select
              value={(list.filters.kind as string) ?? ANY}
              onValueChange={(value) => list.setFilter('kind', value === ANY ? undefined : value)}
            >
              <SelectTrigger id="category-kind-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="category-include-deleted"
            checked={list.includeDeleted}
            onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
          />
          <Label htmlFor="category-include-deleted" className="font-normal">
            Incluir removidas
          </Label>
        </div>
      </FilterPanel>

      {canCreate ? (
        <div>
          <Button onClick={() => setFormTarget(null)}>Nova conta</Button>
        </div>
      ) : null}

      {showEmpty ? (
        isNarrowed ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum resultado para esta busca"
            description="Nenhuma conta corresponde aos termos e filtros aplicados."
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
            icon={BookOpen}
            title="Plano de contas vazio"
            description="As contas classificam cobranças e despesas na prestação de contas."
          />
        )
      ) : (
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
          emptyIcon={BookOpen}
          rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
        />
      )}

      {formTarget !== undefined ? (
        <CategoryFormDialog
          key={formTarget?.id ?? 'new'}
          category={formTarget ?? undefined}
          condominiumId={condominiumId}
          onClose={() => setFormTarget(undefined)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir conta?"
        description={
          deleting
            ? `"${deleting.name}" saira dos seletores. Lancamentos já classificados nela continuam como estao, e a exclusao pode ser desfeita.`
            : undefined
        }
        actionLabel="Excluir"
        loading={removing}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
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
    </div>
  );
}
