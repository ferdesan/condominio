import {
  MISSING_CATEGORY_LABEL,
  UNCATEGORIZED_LABEL,
  openingBalanceWindow,
  readBreakdown,
  round2,
  resolveOpeningBalance,
  toStatementLines,
} from '@/modules/financial/closing-math';

describe('resolveOpeningBalance', () => {
  const condominium = { openingBalance: 1000, openingBalanceDate: '2026-01-01' };
  const noMovements = { income: 0, expense: 0 };

  it('UT-105: herda o saldo final do mes anterior quando ele esta fechado', () => {
    const resolved = resolveOpeningBalance({
      previous: { status: 'CLOSED', closingBalance: 1234.56, referenceMonth: '2026-08' },
      condominium,
      movements: { income: 999, expense: 999 },
    });

    expect(resolved).toEqual({ amount: 1234.56, source: 'INHERITED', from: '2026-08' });
  });

  it('UT-106: calcula do saldo de abertura mais os movimentos quando nao ha fechamento', () => {
    const resolved = resolveOpeningBalance({
      previous: null,
      condominium,
      movements: { income: 500, expense: 200 },
    });

    expect(resolved).toEqual({ amount: 1300, source: 'COMPUTED', from: '2026-01-01' });
  });

  it('UT-107: nao herda de um mes reaberto, porque os totais gravados nao valem mais', () => {
    const resolved = resolveOpeningBalance({
      previous: { status: 'OPEN', closingBalance: 999_999, referenceMonth: '2026-08' },
      condominium,
      movements: { income: 500, expense: 200 },
    });

    expect(resolved.source).toBe('COMPUTED');
    expect(resolved.amount).toBe(1300);
  });

  it('UT-108: corte nulo nao aplica limite inferior nenhum a janela', () => {
    const monthStart = new Date('2026-09-01T00:00:00');

    expect(openingBalanceWindow(null, monthStart)).toEqual({ from: null, toExclusive: monthStart });
    expect(openingBalanceWindow('2026-01-01', monthStart).from).toEqual(
      new Date('2026-01-01T00:00:00'),
    );

    const resolved = resolveOpeningBalance({
      previous: null,
      condominium: { openingBalance: 0, openingBalanceDate: null },
      movements: { income: 800, expense: 300 },
    });
    expect(resolved).toEqual({ amount: 500, source: 'COMPUTED', from: null });
  });

  it('UT-109: zero legitimo e um valor, e nao um vazio', () => {
    const resolved = resolveOpeningBalance({
      previous: null,
      condominium: { openingBalance: 0, openingBalanceDate: '2026-01-01' },
      movements: noMovements,
    });

    expect(resolved).toEqual({ amount: 0, source: 'COMPUTED', from: '2026-01-01' });
  });
});

describe('toStatementLines', () => {
  const names = new Map([
    ['cat-1', 'Taxa condominial'],
    ['cat-2', 'Fundo de reserva'],
  ]);

  it('UT-110: resolve os nomes e ordena por total decrescente', () => {
    const { lines } = toStatementLines(
      [
        { categoryId: 'cat-2', total: '100.00' },
        { categoryId: 'cat-1', total: '900.00' },
      ],
      names,
    );

    expect(lines).toEqual([
      { categoryId: 'cat-1', name: 'Taxa condominial', total: 900 },
      { categoryId: 'cat-2', name: 'Fundo de reserva', total: 100 },
    ]);
  });

  it('UT-111: categoria nula vira linha explicita, e nunca um descarte', () => {
    const { lines, total } = toStatementLines(
      [
        { categoryId: null, total: '250.00' },
        { categoryId: 'cat-1', total: '750.00' },
      ],
      names,
    );

    expect(lines.map((line) => line.name)).toContain(UNCATEGORIZED_LABEL);
    expect(total).toBe(1000);
  });

  it('UT-112: categoria removida do cadastro conserva o nome no documento', () => {
    const withDeleted = new Map(names).set('cat-3', 'Manutencao predial');

    const { lines } = toStatementLines([{ categoryId: 'cat-3', total: '42.00' }], withDeleted);

    expect(lines[0].name).toBe('Manutencao predial');
  });

  it('UT-113: o total do topo e a soma das linhas que o compoem', () => {
    const rows = [
      { categoryId: null, total: '10.01' },
      { categoryId: 'cat-1', total: '20.02' },
      { categoryId: 'cat-2', total: '30.03' },
    ];

    const { lines, total } = toStatementLines(rows, names);

    expect(total).toBe(60.06);
    // A soma crua das tres linhas da 60.059999999999995 em ponto flutuante: a
    // igualdade que o balancete promete e entre numeros de dinheiro, e por isso
    // os dois lados passam pelo mesmo arredondamento.
    expect(total).toBe(round2(lines.reduce((sum, line) => sum + line.total, 0)));
  });

  it('UT-114: conjunto vazio rende lista vazia e total zero', () => {
    expect(toStatementLines([], names)).toEqual({ lines: [], total: 0 });
  });

  it('UT-115: categoria orfa mantem o id e recebe rotulo proprio, sem lancar', () => {
    const { lines, total } = toStatementLines([{ categoryId: 'sumiu', total: '15.00' }], names);

    expect(lines).toEqual([
      { categoryId: 'sumiu', name: MISSING_CATEGORY_LABEL, total: 15 },
    ]);
    expect(total).toBe(15);
  });
});

describe('readBreakdown', () => {
  it('UT-116: documento gravado sem a linha de reconciliacao le como zero, e nao lanca', () => {
    const stored = { income: [{ categoryId: null, name: 'Sem categoria', total: 10 }], expense: [] };

    expect(readBreakdown(stored).unresolvedPaidExpenses).toEqual({ count: 0, total: 0 });
    expect(readBreakdown(stored).income).toHaveLength(1);
  });

  it('UT-117: chave desconhecida no documento e ignorada, sem erro', () => {
    const stored = {
      income: [],
      expense: [],
      unresolvedPaidExpenses: { count: 2, total: 50 },
      totalDeUmaVersaoFutura: 999,
    };

    expect(readBreakdown(stored)).toEqual({
      income: [],
      expense: [],
      unresolvedPaidExpenses: { count: 2, total: 50 },
    });
    expect(readBreakdown(null)).toEqual({
      income: [],
      expense: [],
      unresolvedPaidExpenses: { count: 0, total: 0 },
    });
  });
});
