import { describe, expect, it } from 'vitest';
import { buildClosingCsv, closingCsvFileName } from './closing-csv';
import { makeStatement, makeStatementEntry } from './test-utils';

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

describe('buildClosingCsv com os lançamentos', () => {
  it('UT-131: o resumo vem primeiro, depois o cabeçalho dos lançamentos e uma linha por movimento', () => {
    const csv = buildClosingCsv(makeStatement(), [
      makeStatementEntry({
        sourceId: 'payment-1',
        occurredAt: '2026-08-03T12:00:00.000Z',
        description: 'Taxa da 101',
        counterpart: '101',
        amount: 500,
      }),
      makeStatementEntry({
        sourceId: 'payment-2',
        occurredAt: '2026-08-04T12:00:00.000Z',
        categoryId: null,
        categoryName: 'Sem categoria',
        description: 'Depósito avulso',
        counterpart: null,
        amount: 75.5,
      }),
      makeStatementEntry({
        kind: 'EXPENSE',
        sourceId: 'expense-1',
        occurredAt: '2026-08-11T12:00:00.000Z',
        categoryId: 'cat-2',
        categoryName: 'Agua e energia',
        description: 'Conta de energia',
        counterpart: 'Companhia Elétrica',
        amount: 320,
      }),
    ]);
    const rows = rowsOf(csv);
    const header = rows.indexOf('Lançamentos');

    // O resumo inteiro esta acima: o titulo dos lancamentos vem depois da ultima
    // linha de totais, e nao no meio dela.
    expect(header).toBeGreaterThan(rows.map((row) => row.startsWith('Totais')).lastIndexOf(true));

    expect(rows[header + 1]).toBe('Data;Seção;Categoria;Histórico;Contraparte;Valor');
    expect(rows[header + 2]).toBe('03/08/2026;Entrada;Taxa condominial;Taxa da 101;101;500,00');
    // Contraparte ausente e celula vazia, e nao o traco da tela: o traco e
    // legivel para quem le e vira texto para quem soma.
    expect(rows[header + 3]).toBe('04/08/2026;Entrada;Sem categoria;Depósito avulso;;75,50');
    expect(rows[header + 4]).toBe(
      '11/08/2026;Saída;Agua e energia;Conta de energia;Companhia Elétrica;320,00',
    );
    // Um movimento, uma linha: nada depois da ultima.
    expect(rows).toHaveLength(header + 5);
  });

  it('UT-132: chamado só com o resumo, produz exatamente o arquivo que a esteira anterior produzia', () => {
    const statement = makeStatement();

    /*
      O segundo argumento e opcional de proposito: um mes cujos lancamentos ainda
      nao chegaram continua exportavel. Se ele virar obrigatorio, este caso fica
      vermelho, que e exatamente o que se quer dele.
    */
    expect(buildClosingCsv(statement)).toBe(
      '﻿' +
        [
          'Seção;Categoria;Valor',
          'Entradas;Taxa condominial;3000,00',
          'Saídas;Agua e energia;1200,00',
          'Totais;Saldo anterior;1000,00',
          'Totais;Total de entradas;3000,00',
          'Totais;Total de saídas;1200,00',
          'Totais;Resultado do mês;1800,00',
          'Totais;Saldo final;2800,00',
        ].join('\r\n') +
        '\r\n',
    );

    // Lista vazia e o mesmo que ausente: nao ha bloco a abrir sem movimento.
    expect(buildClosingCsv(statement, [])).toBe(buildClosingCsv(statement));
  });

  it('UT-133: histórico que contém o separador é escapado, e a linha mantém as colunas', () => {
    const csv = buildClosingCsv(makeStatement(), [
      makeStatementEntry({ description: 'Taxa; extra', amount: 42 }),
    ]);
    const line = rowsOf(csv).at(-1) as string;

    expect(line).toBe('05/08/2026;Entrada;Taxa condominial;"Taxa; extra";101;42,00');
    expect(line.split(';')).toHaveLength(7); // as aspas preservam o campo para o leitor de CSV
  });

  it('UT-134: entrada e saída carregam rótulos de seção distintos', () => {
    const csv = buildClosingCsv(makeStatement(), [
      makeStatementEntry({ sourceId: 'payment-1' }),
      makeStatementEntry({
        kind: 'EXPENSE',
        sourceId: 'expense-1',
        counterpart: 'Companhia Elétrica',
      }),
    ]);
    const rows = rowsOf(csv);
    const sections = rows
      .slice(rows.indexOf('Lançamentos') + 2)
      .map((row) => row.split(';')[1] as string);

    expect(sections).toEqual(['Entrada', 'Saída']);

    /*
      Distintos tambem dos rotulos do resumo, que estao no plural: ordenar a
      planilha por esta coluna separa os quatro grupos, em vez de juntar um
      lancamento com a soma da categoria a que ele pertence.
    */
    expect(sections).not.toContain('Entradas');
    expect(sections).not.toContain('Saídas');
  });
});

describe('closingCsvFileName', () => {
  it('nomeia o arquivo pela competência', () => {
    expect(closingCsvFileName('2026-08')).toBe('balancete-2026-08.csv');
  });
});
