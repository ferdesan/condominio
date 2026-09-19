import {
  MISSING_CATEGORY_LABEL,
  UNCATEGORIZED_LABEL,
  openingBalanceWindow,
  readBreakdown,
  round2,
  resolveOpeningBalance,
  sortStatementEntries,
  toStatementEntry,
  toStatementLines,
  type StatementEntry,
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

describe('toStatementEntry', () => {
  const names = new Map([
    ['cat-1', 'Taxa condominial'],
    ['cat-2', 'Manutencao predial'],
  ]);

  /** Linha crua como o QueryBuilder a devolve: dinheiro em texto, o resto nulavel. */
  const incomeRow = {
    sourceId: 'pag-1',
    occurredAt: new Date('2026-08-12T10:30:00.000Z'),
    categoryId: 'cat-1',
    description: 'Taxa de agosto',
    counterpart: 'A-101',
    amount: '600.00',
    method: 'PIX',
  };

  it('UT-125: linha de entrada vira lancamento com a unidade, o nome da categoria e o valor numerico', () => {
    const entry = toStatementEntry('INCOME', incomeRow, names);

    expect(entry).toEqual({
      kind: 'INCOME',
      occurredAt: new Date('2026-08-12T10:30:00.000Z'),
      categoryId: 'cat-1',
      categoryName: 'Taxa condominial',
      description: 'Taxa de agosto',
      counterpart: 'A-101',
      amount: 600,
      method: 'PIX',
      sourceId: 'pag-1',
    });
    // O DECIMAL chega como texto do banco e sai numero da montagem: o documento
    // soma os lancamentos, e somar strings concatenaria em vez de adicionar.
    expect(typeof entry.amount).toBe('number');
  });

  it('UT-126: categoria nula rende a linha "Sem categoria" e conserva o nulo', () => {
    const entry = toStatementEntry('INCOME', { ...incomeRow, categoryId: null }, names);

    expect(entry.categoryId).toBeNull();
    expect(entry.categoryName).toBe(UNCATEGORIZED_LABEL);
    // Nada se perde no caminho: nao classificar nao e motivo para sumir do
    // documento, e o resto da linha continua inteiro.
    expect(entry.amount).toBe(600);
    expect(entry.counterpart).toBe('A-101');
    expect(entry.sourceId).toBe('pag-1');
  });

  it('UT-127: categoria que o cadastro nao tem mais conserva o id e ganha rotulo proprio', () => {
    const entry = toStatementEntry('INCOME', { ...incomeRow, categoryId: 'sumiu' }, names);

    expect(entry.categoryId).toBe('sumiu');
    // Distinto de `Sem categoria` de proposito: ali ninguem classificou, aqui
    // alguem classificou e a referencia se perdeu.
    expect(entry.categoryName).toBe(MISSING_CATEGORY_LABEL);
    expect(entry.categoryName).not.toBe(UNCATEGORIZED_LABEL);
  });

  it('UT-128: saida sem prestador fica sem a outra parte, e ainda assim completa', () => {
    const entry = toStatementEntry(
      'EXPENSE',
      {
        sourceId: 'desp-1',
        occurredAt: new Date('2026-08-15T00:00:00.000Z'),
        categoryId: 'cat-2',
        description: 'Reparo do portao',
        counterpart: null,
        amount: '250.50',
        method: null,
      },
      names,
    );

    expect(entry.kind).toBe('EXPENSE');
    expect(entry.counterpart).toBeNull();
    expect(entry.method).toBeNull();
    // Sem prestador nao e lancamento pela metade: valor, data, descricao e
    // categoria seguem la, e e isso que o documento mostra.
    expect(entry.amount).toBe(250.5);
    expect(entry.categoryName).toBe('Manutencao predial');
    expect(entry.description).toBe('Reparo do portao');
  });
});

describe('sortStatementEntries', () => {
  const entry = (overrides: Partial<StatementEntry>): StatementEntry => ({
    kind: 'INCOME',
    occurredAt: new Date('2026-08-10T00:00:00.000Z'),
    categoryId: null,
    categoryName: UNCATEGORIZED_LABEL,
    description: 'Lancamento',
    counterpart: null,
    amount: 100,
    method: null,
    sourceId: 'a',
    ...overrides,
  });

  it('UT-129: tres lancamentos de datas diferentes saem por data crescente, seja qual for a ordem de chegada', () => {
    const dia = (day: number) =>
      new Date(`2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`);

    const sorted = sortStatementEntries([
      entry({ occurredAt: dia(20), sourceId: 'c' }),
      entry({ occurredAt: dia(5), sourceId: 'a' }),
      entry({ occurredAt: dia(12), sourceId: 'b' }),
    ]);

    expect(sorted.map((item) => item.sourceId)).toEqual(['a', 'b', 'c']);
  });

  it('UT-130: mesma data e mesmo valor desempatam por sourceId, e a ordem nao depende da chegada', () => {
    const mesmoDia = new Date('2026-08-12T00:00:00.000Z');
    const primeiro = entry({ occurredAt: mesmoDia, amount: 300, sourceId: 'aaa' });
    const segundo = entry({ occurredAt: mesmoDia, amount: 300, sourceId: 'bbb' });

    // O terceiro criterio e o que torna a ordem total: sem ele estas duas linhas
    // sairiam em ordem arbitraria, duas leituras do mesmo mes fechado poderiam
    // divergir, e o diff de duas exportacoes deixaria de significar alguma coisa.
    expect(sortStatementEntries([segundo, primeiro]).map((item) => item.sourceId)).toEqual([
      'aaa',
      'bbb',
    ]);
    expect(sortStatementEntries([primeiro, segundo]).map((item) => item.sourceId)).toEqual([
      'aaa',
      'bbb',
    ]);

    // E o desempate so entra depois do valor: no mesmo dia, o maior vem antes,
    // ainda que o `sourceId` dele seja o ultimo da ordem alfabetica.
    const porValor = sortStatementEntries([
      entry({ occurredAt: mesmoDia, amount: 50, sourceId: 'aaa' }),
      entry({ occurredAt: mesmoDia, amount: 900, sourceId: 'zzz' }),
    ]);
    expect(porValor.map((item) => item.amount)).toEqual([900, 50]);
  });
});
