import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt, Search, SearchX } from 'lucide-react';
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
import type { ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { Unit } from '@/types/api';
import { CHARGE_STATUSES, type Charge, type FinancialCategory } from '@/types/financial';
import { chargeFilters, chargeHooks, CHARGES_KEY, useCancelCharge } from '../financial-hooks';
import {
  CATEGORY_UNAVAILABLE,
  CHARGE_STATUS_LABELS,
  chargeLabel,
  NO_CATEGORY,
  outstandingAmount,
  UNIT_UNAVAILABLE,
} from '../financial-labels';
import { ChargeFormDialog } from './charge-form-dialog';
import { ChargeStatusBadge } from './charge-status-badge';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { ChargePaymentsDialog } from './charge-payments-dialog';

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const ANY = '__all__';

const STATUS_OPTIONS = CHARGE_STATUSES.map((value) => ({
  value,
  label: CHARGE_STATUS_LABELS[value],
}));

/** Recusa do servidor apresentada na linha que a provocou. */
type RowError = { id: string; message: string } | null;

export interface ChargesSectionProps {
  condominiumId: string;
  units: Unit[];
  categories: FinancialCategory[];
}

/**
 * Cobrancas do condominio.
 *
 * Os filtros e as acoes de linha moram neste arquivo, e nao em modulos proprios
 * como nas demais telas: esta e a unica tela do sistema com tres secoes sob uma
 * rota, e espalhar cada uma em quatro arquivos tornaria a feature dificil de
 * percorrer. Cada secao e um arquivo.
 *
 * Baixa e cancelamento sao oferecidos por permissao, e nao por situacao: quem
 * decide se a transicao vale e o servidor — ele recusa a baixa de uma cobranca
 * cancelada e o cancelamento de uma ja quitada —, e a recusa aparece na linha.
 */
export function ChargesSection({ condominiumId, units, categories }: ChargesSectionProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState();
  const [formTarget, setFormTarget] = useState<Charge | null | undefined>(undefined);
  const [paying, setPaying] = useState<Charge | null>(null);
  const [viewingPayments, setViewingPayments] = useState<Charge | null>(null);
  const [canceling, setCanceling] = useState<Charge | null>(null);
  const [deleting, setDeleting] = useState<Charge | null>(null);
  const [removing, setRemoving] = useState(false);
  const removingRef = useRef(false);
  const cancelRef = useRef(false);
  const [rowError, setRowError] = useState<RowError>(null);

  const canCreate = can('charge:create');
  const canUpdate = can('charge:update');
  const canDelete = can('charge:delete');
  // A baixa exige `payment:create`, e nao `charge:update`: quem corrige a
  // descricao de uma cobranca nao necessariamente da baixa nela.
  const canRegisterPayment = can('payment:create');
  /**
   * Ver o historico exige `payment:read`, e nao `payment:create`: consultar o
   * que ja foi baixado e leitura, e e a divisao que `financial.routes.ts` faz
   * entre `GET /financial/payments` e a rota de baixa.
   */
  const canReadPayments = can('payment:read');

  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const params: ListParams = useMemo(() => {
    const base = list.toListParams(DEFAULT_PER_PAGE);
    return {
      ...base,
      filters: pickFilters(chargeFilters, { ...base.filters, condominiumId }),
    };
  }, [list, condominiumId]);

  const query = chargeHooks.useList(params);
  const remove = chargeHooks.useRemove();
  const restore = chargeHooks.useRestore();

  const cancel = useCancelCharge({
    onError: (error: ApiError, variables) => {
      queryClient.invalidateQueries({ queryKey: [CHARGES_KEY] });
      setRowError({ id: variables.id, message: error.message });
    },
    onSuccess: () => setRowError(null),
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.meta.totalPages;
  const { page, setPage } = list;

  useEffect(() => {
    if (totalPages !== undefined && totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page, setPage]);

  function refreshOnRefusal(): void {
    queryClient.invalidateQueries({ queryKey: [CHARGES_KEY] });
  }

  const chips: Filter[] = [];
  if (list.filters.status) {
    chips.push({
      id: 'status',
      label: 'Situação',
      value: CHARGE_STATUS_LABELS[list.filters.status as keyof typeof CHARGE_STATUS_LABELS],
    });
  }
  if (list.filters.referenceMonth) {
    chips.push({
      id: 'referenceMonth',
      label: 'Competência',
      value: String(list.filters.referenceMonth),
    });
  }
  if (list.filters.unitId) {
    chips.push({
      id: 'unitId',
      label: 'Unidade',
      value: unitsById.get(String(list.filters.unitId))?.number ?? String(list.filters.unitId),
    });
  }

  function handleChipChange(remaining: Filter[]): void {
    const kept = new Set(remaining.map((chip) => chip.id));
    for (const chip of chips) {
      if (!kept.has(chip.id)) list.setFilter(chip.id, undefined);
    }
  }

  const columns: Column<Charge>[] = [
    {
      key: 'description',
      label: 'Cobrança',
      sortable: true,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={row.deletedAt ? 'line-through' : 'font-medium'}>
              {row.description}
            </span>
            {row.deletedAt ? <Badge variant="destructive">Removida</Badge> : null}
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
      key: 'unitId',
      label: 'Unidade',
      sortable: true,
      // A unidade vem aninhada na resposta (`ChargeRepository.relations`), entao
      // a celula nao precisa de uma segunda consulta para nomea-la.
      render: (_value, row) =>
        row.unit?.number ??
        unitsById.get(row.unitId)?.number ?? (
          <span className="text-muted-foreground">{UNIT_UNAVAILABLE}</span>
        ),
    },
    { key: 'referenceMonth', label: 'Competência', sortable: true },
    {
      // Nao ordenavel: `dueDate` e o `defaultSort` e nao entra no conjunto
      // ordenavel do servidor — a chave seria descartada em silencio.
      key: 'dueDate',
      label: 'Vencimento',
      render: (_value, row) => formatDate(row.dueDate),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (_value, row) => (
        <div className="whitespace-nowrap tabular-nums">
          <p>{formatCurrency(row.amount)}</p>
          {/* O saldo e o que importa para cobrar: valor de face mais encargos,
              menos desconto e o que ja entrou. */}
          <p className="text-xs text-muted-foreground">
            saldo {formatCurrency(outstandingAmount(row))}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Situação',
      sortable: true,
      render: (_value, row) => <ChargeStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_value, row) => {
        const label = chargeLabel(row);

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
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {canRegisterPayment ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Registrar pagamento de ${label}`}
                  onClick={() => setPaying(row)}
                >
                  Registrar pagamento
                </Button>
              ) : null}

              {/*
                O histórico e o único lugar onde uma baixa parcial se explica: a
                coluna de valor mostra o total da cobrança, e não os lancamentos
                que a compuseram.
              */}
              {canReadPayments ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Ver pagamentos de ${label}`}
                  onClick={() => setViewingPayments(row)}
                >
                  Pagamentos
                </Button>
              ) : null}

              {canUpdate ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Cancelar ${label}`}
                    onClick={() => setCanceling(row)}
                  >
                    Cancelar
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

            {rowError?.id === row.id ? (
              <p role="alert" className="text-xs text-destructive">
                {rowError.message}
              </p>
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
            <Label htmlFor="charge-search">Buscar</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="charge-search"
                className="pl-10"
                placeholder="Descrição ou código de barras"
                value={list.searchInput}
                onChange={(event) => list.setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charge-status-filter">Situação</Label>
            <Select
              value={(list.filters.status as string) ?? ANY}
              onValueChange={(value) => list.setFilter('status', value === ANY ? undefined : value)}
            >
              <SelectTrigger id="charge-status-filter">
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
            <Label htmlFor="charge-month-filter">Competência</Label>
            <Input
              id="charge-month-filter"
              type="month"
              value={(list.filters.referenceMonth as string) ?? ''}
              onChange={(event) =>
                list.setFilter('referenceMonth', event.target.value || undefined)
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charge-unit-filter">Unidade</Label>
            <Select
              value={(list.filters.unitId as string) ?? ANY}
              onValueChange={(value) => list.setFilter('unitId', value === ANY ? undefined : value)}
            >
              <SelectTrigger id="charge-unit-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Todas</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="charge-include-deleted"
            checked={list.includeDeleted}
            onCheckedChange={(checked) => list.setIncludeDeleted(checked === true)}
          />
          <Label htmlFor="charge-include-deleted" className="font-normal">
            Incluir removidas
          </Label>
        </div>
      </FilterPanel>

      {canCreate ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setFormTarget(null)}>Nova cobrança</Button>
        </div>
      ) : null}

      {showEmpty ? (
        isNarrowed ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum resultado para esta busca"
            description="Nenhuma cobrança corresponde aos termos e filtros aplicados."
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
            icon={Receipt}
            title="Nenhuma cobrança lancada"
            description="Gere as taxas do mês de uma vez ou lance uma cobrança avulsa."
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
          emptyIcon={Receipt}
          rowClassName={(row) => (row.deletedAt ? 'bg-muted/40 text-muted-foreground' : '')}
        />
      )}

      {formTarget !== undefined ? (
        <ChargeFormDialog
          key={formTarget?.id ?? 'new'}
          charge={formTarget ?? undefined}
          condominiumId={condominiumId}
          units={units}
          categories={categories}
          onClose={() => setFormTarget(undefined)}
        />
      ) : null}

      {paying ? <RegisterPaymentDialog charge={paying} onClose={() => setPaying(null)} /> : null}

      {viewingPayments ? (
        <ChargePaymentsDialog charge={viewingPayments} onClose={() => setViewingPayments(null)} />
      ) : null}

      <ConfirmDialog
        open={canceling !== null}
        title="Cancelar cobrança?"
        description={
          canceling
            ? `"${canceling.description}" deixara de ser cobrada. O registro permanece no histórico como cancelada.`
            : undefined
        }
        actionLabel="Cancelar cobrança"
        cancelLabel="Voltar"
        variant="warning"
        onCancel={() => setCanceling(null)}
        onConfirm={() => {
          if (!canceling || cancelRef.current) return;
          const target = canceling;
          cancelRef.current = true;
          setRowError(null);
          cancel.mutate(
            { id: target.id },
            {
              onSettled: () => {
                cancelRef.current = false;
                setCanceling(null);
              },
            },
          );
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir cobrança?"
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
