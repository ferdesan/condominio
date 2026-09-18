import { describe, expect, it } from 'vitest';
import { buildClosingCsv, closingCsvFileName } from './closing-csv';
import { makeStatement } from './test-utils';

/** Linhas sem o BOM, para as asserções falarem do conteúdo e não do preâmbulo. */
function rowsOf(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
}

describe('buildClosingCsv', () => {
  it('UT-118: monta cabeçalho, as linhas na ordem da tela e o bloco de totais', () => {
    const csv = buildClosingCsv(
      makeStatement({
        income: [
          { categoryId: 'c1', name: 'Taxa condominial', total: 3_000 },
          { categoryId: 'c2', name: 'Fundo de reserva', total: 500 },
        ],
        expense: [{ categoryId: 'c3', name: 'Folha de pagamento', total: 1_200 }],
        totalIncome: 3_500,
        totalExpense: 1_200,
        result: 2_300,
        closingBalance: 3_300,
      }),
    );
    const rows = rowsOf(csv);

    expect(rows[0]).toBe('Seção;Categoria;Valor');
    expect(rows[1]).toBe('Entradas;Taxa condominial;3000,00');
    expect(rows[2]).toBe('Entradas;Fundo de reserva;500,00');
    expect(rows[3]).toBe('Saídas;Folha de pagamento;1200,00');
    expect(rows).toContain('Totais;Total de entradas;3500,00');
    expect(rows).toContain('Totais;Resultado do mês;2300,00');
    expect(rows).toContain('Totais;Saldo final;3300,00');
  });

  it('UT-119: valor com uma casa decimal sai com vírgula e duas casas', () => {
    const csv = buildClosingCsv(
      makeStatement({
        income: [{ categoryId: 'c1', name: 'Taxa condominial', total: 1_234.5 }],
      }),
    );

    expect(rowsOf(csv)[1]).toBe('Entradas;Taxa condominial;1234,50');
  });

  it('UT-120: categoria que contém o separador é escapada, e não parte a coluna', () => {
    const csv = buildClosingCsv(
      makeStatement({
        expense: [{ categoryId: 'c9', name: 'Água; luz', total: 80 }],
        income: [],
      }),
    );
    const line = rowsOf(csv).find((row) => row.startsWith('Saídas')) as string;

    expect(line).toBe('Saídas;"Água; luz";80,00');
    expect(line.split(';')).toHaveLength(4); // as aspas preservam o campo para o leitor de CSV
  });

  it('UT-121: "Sem categoria" e a linha de reconciliação aparecem, a segunda fora dos totais', () => {
    const csv = buildClosingCsv(
      makeStatement({
        income: [{ categoryId: null, name: 'Sem categoria', total: 250 }],
        expense: [],
        unresolvedPaidExpenses: { count: 2, total: 900 },
      }),
    );
    const rows = rowsOf(csv);

    expect(rows).toContain('Entradas;Sem categoria;250,00');

    const reconciliation = rows.findIndex((row) => row.startsWith('Fora dos totais'));
    const lastTotal = rows.map((row) => row.startsWith('Totais')).lastIndexOf(true);
    expect(reconciliation).toBeGreaterThan(lastTotal);
    expect(rows[reconciliation]).toBe('Fora dos totais;Pagas sem data de pagamento;900,00');
  });

  it('UT-122: começa com o BOM de UTF-8 e termina cada linha com CRLF', () => {
    const csv = buildClosingCsv(makeStatement());

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    // Nenhum \n solto: todo fim de linha e precedido de \r.
    expect(csv.split('\n').length - 1).toBe(csv.split('\r\n').length - 1);
  });

  it('sem despesa paga sem data, a linha de reconciliação não aparece', () => {
    const csv = buildClosingCsv(makeStatement({ unresolvedPaidExpenses: { count: 0, total: 0 } }));

    expect(csv).not.toContain('Fora dos totais');
  });
});

describe('closingCsvFileName', () => {
  it('nomeia o arquivo pela competência', () => {
    expect(closingCsvFileName('2026-08')).toBe('balancete-2026-08.csv');
  });
});
