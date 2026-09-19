import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { DataTable, type Column } from '@/components/common/data-table';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { ClosingEntryKind, PaymentMethod, StatementEntry } from '@/types/financial';
import { CLOSING_ENTRY_KIND_LABELS, paymentMethodLabel } from './financial-labels';

/**
 * Quantos lancamentos cabem numa pagina.
 *
 * O recorte e no cliente: o mes inteiro ja chegou numa resposta so (ADR-004), e
 * a `DataTable` fatia o que tem em memoria. Vinte e o mesmo tamanho de pagina das
 * listagens do produto, entao a rolagem daqui parece com a delas.
 */
const PAGE_SIZE = 20;

/** Valor sentinela do filtro: o Radix nao aceita `SelectItem` com valor vazio. */
const ALL_CATEGORIES = '__all__';

/**
 * Segundo sentinela, para a linha sem categoria.
 *
 * `categoryId` nulo e um valor de verdade — o lancamento que ninguem classificou
 * entra no documento como qualquer outro —, entao ele precisa de uma opcao
 * propria no filtro em vez de ser confundido com "todas".
 */
const NO_CATEGORY_VALUE = '__none__';

const optionValueOf = (entry: StatementEntry): string => entry.categoryId ?? NO_CATEGORY_VALUE;

export interface ClosingEntriesTableProps {
  entries: StatementEntry[];
  /** `true` quando as linhas vieram gravadas no fechamento, e nao calculadas. */
  frozen: boolean;
}

/**
 * A lista de lancamentos do mes: uma linha por pagamento recebido e por despesa
 * paga, na ordem que o servidor fixou — data crescente, valor decrescente,
 * origem para desempatar.
 *
 * **Nenhuma coluna e ordenavel, de proposito.** Aquela ordem e total e vale para
 * os dois modos de leitura, e e o que torna o diff de duas exportacoes do mesmo
 * mes fechado uma informacao. Reordenar aqui produziria um documento cuja
 * sequencia depende de onde o leitor clicou.
 *
 * O filtro e a paginacao tambem sao locais: operam sobre o que foi enviado, que
 * e exatamente o mes (ADR-004). Nenhum dos dois gera requisicao.
 */
export function ClosingEntriesTable({ entries, frozen }: ClosingEntriesTableProps) {
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);

  /**
   * As categorias sao lidas dos proprios lancamentos, e nao do plano de contas:
   * num mes fechado o nome esta congelado no documento, e uma conta renomeada ou
   * removida depois continua nomeando as linhas que ela classificou.
   */
  const options = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of entries) names.set(optionValueOf(entry), entry.categoryName);
    return [...names]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [entries]);

  const rows = useMemo(
    () =>
      category === ALL_CATEGORIES
        ? entries
        : entries.filter((entry) => optionValueOf(entry) === category),
    [entries, category],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Filtrar encurta a lista, e a pagina em que o leitor estava pode ter deixado
  // de existir; sem o limite a tabela apareceria vazia com linhas disponiveis.
  const currentPage = Math.min(page, totalPages);

  const columns: Column<StatementEntry>[] = [
    { key: 'occurredAt', label: 'Data', render: (value) => formatDate(value as string) },
    {
      key: 'kind',
      label: 'Tipo',
      render: (value) => CLOSING_ENTRY_KIND_LABELS[value as ClosingEntryKind],
    },
    { key: 'categoryName', label: 'Categoria' },
    { key: 'description', label: 'Histórico' },
    { key: 'counterpart', label: 'Contraparte' },
    {
      key: 'method',
      label: 'Forma',
      render: (value) => paymentMethodLabel(value as PaymentMethod | null),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (value) => <span className="tabular-nums">{formatCurrency(value as number)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      {/*
        O filtro some da folha impressa: um seletor de categoria numa prestacao
        de contas de papel nao seleciona coisa alguma, e a contagem ao lado dele
        fala do recorte na tela, que nao e o recorte do documento.
      */}
      <div className="print-hide flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="closing-entries-category">Categoria</Label>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="closing-entries-category" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas as categorias</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatNumber(rows.length)} de {formatNumber(entries.length)} lançamento(s) ·{' '}
          {frozen
            ? 'congelados no fechamento do mês'
            : 'calculados agora, porque o mês está aberto'}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        idKey="sourceId"
        // A busca livre nao entra: o filtro por categoria e o corte que uma
        // prestacao de contas pede, e um campo de texto sobre um documento
        // sugeriria que ha mais mes do que o que esta na tela.
        searchable={false}
        sortable={false}
        pageable
        clientPagination
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyIcon={Receipt}
        // Duas ausencias diferentes: o mes sem movimento algum e o filtro que
        // nao alcancou nenhuma linha. Dizer "nenhum lancamento" no segundo caso
        // esconderia do leitor que o resto do mes continua ali.
        emptyTitle={
          entries.length === 0 ? 'Nenhum lançamento neste mês' : 'Nenhum lançamento nesta categoria'
        }
        emptyDescription={
          entries.length === 0
            ? 'Nenhum pagamento recebido e nenhuma despesa paga nesta competência.'
            : 'Escolha outra categoria ou volte para todas.'
        }
      />
    </div>
  );
}
