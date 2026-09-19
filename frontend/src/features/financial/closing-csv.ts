/**
 * Exportacao do balancete em CSV.
 *
 * Modulo proprio, e nao funcoes ao lado da secao: exportar funcao junto de um
 * componente levanta `react-refresh/only-export-components`, e o teto de cinco
 * avisos deste repositorio nao sobe.
 *
 * O arquivo e montado no navegador a partir do payload que a tela ja tem
 * (`balancete-mensal` ADR-006). Nao ha requisicao: nada que o servidor pudesse
 * acrescentar a esta planilha esta fora do que a tela carregou.
 *
 * Quem exporta e a rota `/financeiro/balancete/:mes`, e so ela (ADR-005): o
 * arquivo carrega o resumo **e** os lancamentos, e exportar tambem da secao de
 * `/financeiro` produziria dois arquivos de mesmo nome com conteudos
 * diferentes.
 */

import { formatDate } from '@/lib/format';
import type { MonthlyStatement, StatementEntry } from '@/types/financial';
import { CLOSING_ENTRY_KIND_LABELS } from './financial-labels';

/** Ponto e virgula, CRLF e BOM: o consumidor e o Excel em pt-BR. */
const SEPARATOR = ';';
const ROW_END = '\r\n';
const BOM = '﻿';

/**
 * Virgula decimal e duas casas, sem separador de milhar.
 *
 * O milhar em ponto e ambiguo para quem abre a planilha com outra configuracao
 * regional, e o Excel em pt-BR le `1234,50` como numero sem ele.
 */
function money(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Campo que contenha o separador, aspas ou quebra de linha vai entre aspas, com
 * as aspas internas dobradas. Sem isto, uma categoria chamada "Agua; luz"
 * partiria a linha em duas colunas.
 */
function cell(value: string | number): string {
  const text = String(value);
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function row(...cells: (string | number)[]): string {
  return cells.map(cell).join(SEPARATOR);
}

/**
 * O balancete como planilha: as mesmas linhas da tela, na mesma ordem.
 *
 * A linha das despesas pagas sem data fica **depois** do bloco de totais e
 * rotulada como fora dele — ela existe para ser resolvida, e somar seria
 * exatamente o erro que ela denuncia (ADR-004).
 *
 * Os lancamentos entram num **segundo bloco do mesmo arquivo**, e nao num
 * arquivo proprio: uma prestacao de contas e um documento, e dois downloads com
 * o mesmo nome e conteudos diferentes seriam o problema que o ADR-005 recusou.
 *
 * O segundo argumento e **opcional de proposito**: um mes cujos lancamentos
 * ainda nao chegaram continua exportavel, e o arquivo que sai e exatamente o que
 * a esteira anterior produzia.
 */
export function buildClosingCsv(
  statement: MonthlyStatement,
  entries: StatementEntry[] = [],
): string {
  const rows: string[] = [row('Seção', 'Categoria', 'Valor')];

  for (const line of statement.income) {
    rows.push(row('Entradas', line.name, money(line.total)));
  }
  for (const line of statement.expense) {
    rows.push(row('Saídas', line.name, money(line.total)));
  }

  rows.push(row('Totais', 'Saldo anterior', money(statement.openingBalance.amount)));
  rows.push(row('Totais', 'Total de entradas', money(statement.totalIncome)));
  rows.push(row('Totais', 'Total de saídas', money(statement.totalExpense)));
  rows.push(row('Totais', 'Resultado do mês', money(statement.result)));
  rows.push(row('Totais', 'Saldo final', money(statement.closingBalance)));

  if (statement.unresolvedPaidExpenses.count > 0) {
    rows.push(
      row(
        'Fora dos totais',
        'Pagas sem data de pagamento',
        money(statement.unresolvedPaidExpenses.total),
      ),
    );
  }

  if (entries.length > 0) {
    // Linha em branco e um titulo: os dois blocos tem larguras diferentes, e sem
    // a separacao o leitor da planilha veria uma tabela so com colunas tortas.
    rows.push('');
    rows.push(row('Lançamentos'));
    rows.push(row('Data', 'Seção', 'Categoria', 'Histórico', 'Contraparte', 'Valor'));

    for (const entry of entries) {
      rows.push(
        row(
          formatDate(entry.occurredAt),
          // Singular, e os mesmos rotulos da tela: `Entrada` e `Saída` nomeiam
          // um lancamento, enquanto o `Entradas`/`Saídas` do resumo nomeia um
          // total por categoria. Ordenar a planilha por esta coluna separa os
          // quatro grupos em vez de misturar linha e soma.
          CLOSING_ENTRY_KIND_LABELS[entry.kind],
          entry.categoryName,
          entry.description,
          // Celula vazia, e nao o traco da tela: o traco e legivel para quem le,
          // e vira texto para quem soma.
          entry.counterpart ?? '',
          money(entry.amount),
        ),
      );
    }
  }

  return BOM + rows.join(ROW_END) + ROW_END;
}

export function closingCsvFileName(referenceMonth: string): string {
  return `balancete-${referenceMonth}.csv`;
}

/**
 * Entrega o arquivo ao navegador.
 *
 * Mesma mecanica de `downloadDocument` em `features/documents`, menos a
 * requisicao: `Blob`, URL de objeto, ancora com `download`, e `revokeObjectURL`
 * no `finally` — sem ele o blob fica na memoria da aba ate ela fechar.
 */
export function downloadClosingCsv(statement: MonthlyStatement, entries?: StatementEntry[]): void {
  const blob = new Blob([buildClosingCsv(statement, entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = closingCsvFileName(statement.referenceMonth);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
