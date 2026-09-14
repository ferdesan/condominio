import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, SearchX, Wallet } from 'lucide-react';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FilterPanel, type Filter } from '@/components/common/filter-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import type { ServiceProvider } from '@/types/api';
import { EXPENSE_STATUSES, type Expense, type FinancialCategory } from '@/types/financial';
import { expenseFilters, expenseHooks, EXPENSES_KEY } from '../financial-hooks';
import {
  CATEGORY_UNAVAILABLE,
  EXPENSE_STATUS_LABELS,
  expenseLabel,
  NO_CATEGORY,
  NO_PROVIDER,
} from '../financial-labels';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ExpenseStatusBadge } from './expense-status-badge';
import { PayExpenseDialog } from './pay-expense-dialog';

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

const STATUS_OPTIONS = EXPENSE_STATUSES.map((value) => ({
  value,
  label: EXPENSE_STATUS_LABELS[value],
}));

export interface ExpensesSectionProps {
  condominiumId: string;
  categories: FinancialCategory[];
  providers: ServiceProvider[];
}

/**
 * Despesas do condominio.
 *
 * Como em cobrancas, filtros e acoes de linha moram neste arquivo: a tela tem
 * tres secoes sob uma rota, e cada secao e um arquivo.
 *
 * Liquidar e oferecido por permissao, e nao por situacao: o servidor recusa a
 * liquidacao de uma despesa ja paga ou cancelada, e a recusa dele e a resposta
 * certa — aqui ela herda o toast global, porque a acao acontece dentro de um
 * dialogo que ja fecha ao ter sucesso.
 */
export function ExpensesSection({ condominiumId, categories, providers }: ExpensesSectionProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<Expense | null | undefined>(undefined);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);

  const canCreate = can('expense:create');
  const canUpdate = can('expense:update');
  const canDelete = can('expense:delete');

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: pickFilters(expenseFilters, { ...base.filters, condominiumId }),
    };
  }, [list, condominiumId]);

  const query = expenseHooks.useList(params);
  const remove = expenseHooks.useRemove();
  const restore = expenseHooks.useRestore();

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [EXPENSES_KEY] });
  }

  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Situacao',
      value: EXPENSE_STATUS_LABELS[list.filters.status as keyof typeof EXPENSE_STATUS_LABELS],
    });
  }
  if (list.filters.competence) {
    chips.push({ id: 'competence', label: 'Competencia', value: String(list.filters.competence) });
  }
  if (list.filters.categoryId) {
    chips.push({
      id: 'categoryId',
      label: 'Conta',
      value:
        categoriesById.get(String(list.filters.categoryId))?.name ??
        String(list.filters.categoryId),
    });
  }

  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  const columns: Column<Expense>[] = [
    {
      key: 'description',
      label: 'Despesa',
      sortable: true,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={row.deletedAt ? 'line-through' : 'font-medium'}>{row.description}</span>
            {row.deletedAt ? <Badge variant="destructive">Removida</Badge> : null}
            {row.isRecurring ? <Badge variant="outline">Recorrente</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {row.categoryId
              ? (categoriesById.get(row.categoryId)?.name ?? CATEGORY_UNAVAILABLE)
              : NO_CATEGORY}
          </p>
        </div>
      ),
    },
    {
      key: 'serviceProviderId',
      label: 'Prestador',
      sortable: true,
      render: (_value, row) => {
        if (!row.serviceProviderId) {
          return <span className="text-muted-foreground">{NO_PROVIDER}</span>;
        }
        const provider = providersById.get(row.serviceProviderId);
        return provider?.tradeName ?? provider?.companyName ?? row.serviceProviderId;
      },
    },
    { key: 'competence', label: 'Competencia', sortable: true },
    {
      // Nao ordenavel: `dueDate` e o `defaultSort` e nao entra no conjunto
      // ordenavel do servidor.
      key: 'dueDate',
      label: 'Vencimento',
      render: (_value, row) => formatDate(row.dueDate),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (_value, row) => (
        <span className="whitespace-nowrap tabular-nums">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Situacao',
      sortable: true,
      render: (_value, row) => <ExpenseStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Acoes',
      render: (_value, row) => {
        const label = expenseLabel(row);

        if (row.deletedAt) {
          if (!canUpdate) return null;
          return (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Restaurar ${label}`}
              onClick={() => restore.mutate(row.id, { onError: refreshOnRefusal })}
            >
              Restaurar
            </Button>
          );
        }

        return (
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Liquidar ${label}`}
                  onClick={() => setPaying(row)}
                >
                  Liquidar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar ${label}`}
                  onClick={() => setFormTarget(row)}
                >
                  Editar
                </Button>
              </>
            ) : null}

            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                aria-label={`Excluir ${label}`}
                onClick={() => setDeleting(row)}
              >
                Excluir
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const isNarrowed = Boolean(list.search) || Object.keys(list.filters).length > 0;
  const showEmpty = !query.isPending && rows.length === 0;

  return (
    <div className="space-y-4">
      <FilterPanel filters={chips} onFilterChange={handleChipChange} onClear={list.clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-search">Buscar</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="expense-search"
                className="pl-10"
                placeholder="Descricao ou nota fiscal"
                value={list.searchInput}
                onChange={(event) => list.setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-status-filter">Situacao</Label>
            <Select
              value={(list.filters.status as string) ?? ANY}
              onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
            >
              <SelectTrigger id="expense-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-month-filter">Competencia</Label>
            <Input
              id="expense-month-filter"
              type="month"
              value={(list.filters.competence as string) ?? ''}
              onChange={(event) => list.setFilter('competence', event.target.value || undefined)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-category-filter">Conta</Label>
            <Select
              value={(list.filters.categoryId as string) ?? ANY}
              onValueChange={(value) =>
                list.setFilter('categoryId', value === ANY ? undefined : value)
              }
            >
              <SelectTrigger id="expense-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="expense-include-deleted"
            checked={list.includeDeleted}
            onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
          />
          <Label htmlFor="expense-include-deleted" className="font-normal">
            Incluir removidas
          </Label>
        </div>
      </FilterPanel>

      {canCreate ? (
        <div>
          <Button onClick={() => setFormTarget(null)}>Nova despesa</Button>
        </div>
      ) : null}

      {showEmpty ? (
        isNarrowed ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum resultado para esta busca"
            description="Nenhuma despesa corresponde aos termos e filtros aplicados."
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
            icon={Wallet}
            title="Nenhuma despesa lancada"
            description="Folha, agua, energia e contratos entram aqui, com competencia e vencimento."
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
          emptyIcon={Wallet}
          rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
        />
      )}

      {formTarget !== undefined ? (
        <ExpenseFormDialog
          key={formTarget?.id ?? 'new'}
          expense={formTarget ?? undefined}
          condominiumId={condominiumId}
          categories={categories}
          providers={providers}
          onClose={() => setFormTarget(undefined)}
        />
      ) : null}

      {paying ? <PayExpenseDialog expense={paying} onClose={() => setPaying(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir despesa?"
        description={
          deleting
            ? `"${deleting.description}" deixara de aparecer na listagem. A exclusao e logica e pode ser desfeita.`
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
