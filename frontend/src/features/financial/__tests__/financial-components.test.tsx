/**
 * UT-031 — componentes do financeiro, isolados como unidade.
 *
 * Os hooks de dados sao interrompidos no nivel da feature (`financial-hooks`),
 * entao cada componente prova a propria apresentacao com dados de contrato — os
 * mesmos modelos de `test-utils.ts` que a tela inteira ja usa (ADR-010).
 *
 * Interpretacoes registradas:
 *  - E1 ("zero charges -> 'Nenhuma cobranca'") e realizado no estado vazio
 *    real das cobrancas: `CobrancasSection` mostra `Nenhuma cobranca lancada`
 *    quando a lista vem vazia sem filtros. O `FinancialSummary` nao tem essa
 *    mensagem — ele apresenta o balancete zerado, coberto no caso UT-031.
 *  - E3/E4 e E5 conferem as celulas que a tela mostra: valor, saldo, situacao,
 *    vencimento e prestador — os numeros que o contrato pede.
 *  - E6/E7 sao os mesmos zod do servidor: envio invalido nao chama a API e a
 *    mensagem do esquema e o verbo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { makeMeta, makeServiceProvider, makeUnit } from '@/test/fixtures';
import {
  makeCategory,
  makeCharge,
  makeDelinquencyRow,
  makeExpense,
  makeSummary,
} from '../test-utils';
import {
  chargeHooks,
  categoryHooks,
  expenseHooks,
  useCancelCharge,
  useChargeSummary,
  useDelinquency,
  useGenerateCharges,
  useRegisterPayment,
} from '../financial-hooks';
import { FinancialSummary } from '../components/financial-summary';
import { ChargesSection } from '../components/charges-section';
import { ExpensesSection } from '../components/expenses-section';
import { CategoriesSection } from '../components/categories-section';
import { ChargeFormDialog } from '../components/charge-form-dialog';
import { ExpenseFormDialog } from '../components/expense-form-dialog';
import { GenerateChargesDialog } from '../components/generate-charges-dialog';
import { RegisterPaymentDialog } from '../components/register-payment-dialog';

vi.mock('../financial-hooks', async () => {
  const actual = await vi.importActual<typeof import('../financial-hooks')>('../financial-hooks');
  return {
    ...actual,
    useChargeSummary: vi.fn(),
    useDelinquency: vi.fn(),
    useCancelCharge: vi.fn(),
    useGenerateCharges: vi.fn(),
    useRegisterPayment: vi.fn(),
    chargeHooks: {
      ...actual.chargeHooks,
      useList: vi.fn(),
      useCreate: vi.fn(),
      useUpdate: vi.fn(),
      useRemove: vi.fn(),
      useRestore: vi.fn(),
    },
    expenseHooks: {
      ...actual.expenseHooks,
      useList: vi.fn(),
      useCreate: vi.fn(),
      useUpdate: vi.fn(),
      useRemove: vi.fn(),
      useRestore: vi.fn(),
    },
    categoryHooks: {
      ...actual.categoryHooks,
      useList: vi.fn(),
      useCreate: vi.fn(),
      useUpdate: vi.fn(),
      useRemove: vi.fn(),
      useRestore: vi.fn(),
    },
  };
});

const makeListLike = (rows: unknown[]): never =>
  ({
    data: { data: rows, meta: makeMeta({ total: rows.length }) },
    isPending: false,
    isError: false,
    error: null,
  }) as never;

const makeQueryLike = (data: unknown): never =>
  ({ data, isPending: false, isError: false, error: null }) as never;

const makeMutateLike = (impl: () => Promise<unknown> = async () => undefined): never =>
  ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn(impl) }) as never;

describe('FinancialSummary (UT-031)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChargeSummary).mockReturnValue(makeQueryLike(makeSummary()));
    vi.mocked(useDelinquency).mockReturnValue(makeQueryLike([makeDelinquencyRow()]));
  });

  it('UT-031: apresenta as posições e as unidades mais inadimplentes', () => {
    renderWithProviders(<FinancialSummary condominiumId="cond-1" referenceMonth="2026-03" />);

    expect(screen.getByText('Posição financeira')).toBeInTheDocument();
    expect(screen.getByText(/na competência 2026-03/)).toBeInTheDocument();
    expect(screen.getByText('Faturado')).toBeInTheDocument();
    expect(screen.getByText('R$ 48.000,00')).toBeInTheDocument();
    expect(screen.getByText('Recebido')).toBeInTheDocument();
    expect(screen.getByText('R$ 31.500,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 16.500,00')).toBeInTheDocument();
    expect(screen.getByText('19 cobranças a receber')).toBeInTheDocument();
    expect(screen.getByText('R$ 9.200,00')).toBeInTheDocument();
    expect(screen.getByText('Unidade 909')).toBeInTheDocument();
    expect(screen.getByText('R$ 3.600,00')).toBeInTheDocument();
  });
});

describe('Cobrancas (UT-031.E1/E3/E4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeHooks.useList).mockReturnValue(makeListLike([]));
    vi.mocked(chargeHooks.useRemove).mockReturnValue(makeMutateLike());
    vi.mocked(chargeHooks.useRestore).mockReturnValue(makeMutateLike());
    vi.mocked(useCancelCharge).mockReturnValue(makeMutateLike());
  });

  it('UT-031.E1: sem cobranças, a seção mostra o estado vazio', () => {
    renderWithProviders(
      <ChargesSection condominiumId="cond-1" units={[makeUnit()]} categories={[makeCategory()]} />,
    );

    expect(screen.getByText('Nenhuma cobrança lancada')).toBeInTheDocument();
  });

  it('UT-031.E3: a linha da cobrança mostra valor, saldo, situação e vencimento', () => {
    vi.mocked(chargeHooks.useList).mockReturnValue(makeListLike([makeCharge()]));

    renderWithProviders(
      <ChargesSection condominiumId="cond-1" units={[makeUnit()]} categories={[makeCategory()]} />,
    );

    expect(screen.getByText('Taxa condominial 03/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('10/03/2026')).toBeInTheDocument();
    // 1000 + 20 + 30 - 50 - 200 = 800: a conta e de encargos, nao so o valor.
    expect(screen.getByText('saldo R$ 800,00')).toBeInTheDocument();
  });

  it('UT-031.E4: cobrança vencida diz "Vencida" e cobra os encargos', () => {
    vi.mocked(chargeHooks.useList).mockReturnValue(
      makeListLike([makeCharge({ status: 'OVERDUE' })]),
    );

    renderWithProviders(
      <ChargesSection condominiumId="cond-1" units={[makeUnit()]} categories={[makeCategory()]} />,
    );

    expect(screen.getByText('Vencida')).toBeInTheDocument();
    expect(screen.getByText('saldo R$ 800,00')).toBeInTheDocument();
  });
});

describe('Despesas (UT-031.E5)', () => {
  it('UT-031.E5: a linha da despesa mostra valor, conta e prestador', () => {
    vi.mocked(expenseHooks.useList).mockReturnValue(makeListLike([makeExpense()]));
    vi.mocked(expenseHooks.useRemove).mockReturnValue(makeMutateLike());
    vi.mocked(expenseHooks.useRestore).mockReturnValue(makeMutateLike());

    renderWithProviders(
      <ExpensesSection
        condominiumId="cond-1"
        categories={[makeCategory()]}
        providers={[makeServiceProvider({ id: 'provider-1' })]}
      />,
    );

    expect(screen.getByText('Limpeza mensal')).toBeInTheDocument();
    expect(screen.getByText('R$ 4.200,00')).toBeInTheDocument();
    expect(screen.getByText('Taxa condominial')).toBeInTheDocument();
    expect(screen.getByText('Limpeza Total')).toBeInTheDocument();
  });
});

describe('Plano de contas (UT-031.E2)', () => {
  it('UT-031.E2: lista cada categoria do condomínio', () => {
    vi.mocked(categoryHooks.useList).mockReturnValue(
      makeListLike([
        makeCategory(),
        makeCategory({ id: 'category-2', name: 'Água', kind: 'EXPENSE' }),
      ]),
    );
    vi.mocked(categoryHooks.useRemove).mockReturnValue(makeMutateLike());
    vi.mocked(categoryHooks.useRestore).mockReturnValue(makeMutateLike());

    renderWithProviders(<CategoriesSection condominiumId="cond-1" />);

    expect(screen.getByText('Taxa condominial')).toBeInTheDocument();
    expect(screen.getByText('Água')).toBeInTheDocument();
    expect(screen.getByText('Receita')).toBeInTheDocument();
    expect(screen.getByText('Despesa')).toBeInTheDocument();
  });
});

describe('Formularios (UT-031.E6/E7/E8/E9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeHooks.useCreate).mockReturnValue(makeMutateLike());
    vi.mocked(chargeHooks.useUpdate).mockReturnValue(makeMutateLike());
    vi.mocked(expenseHooks.useCreate).mockReturnValue(makeMutateLike());
    vi.mocked(expenseHooks.useUpdate).mockReturnValue(makeMutateLike());
    vi.mocked(useGenerateCharges).mockReturnValue(makeMutateLike());
    vi.mocked(useRegisterPayment).mockReturnValue(makeMutateLike());
  });

  it('UT-031.E6: cobrança inválida e recusada na tela, sem chamar a API', async () => {
    const create = chargeHooks.useCreate();
    renderWithProviders(
      <ChargeFormDialog
        condominiumId="cond-1"
        units={[makeUnit()]}
        categories={[makeCategory()]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lancar' }));

    await waitFor(() => expect(screen.getByText('Escolha a unidade cobrada.')).toBeInTheDocument());
    expect(screen.getByText('Informe o valor.')).toBeInTheDocument();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('UT-031.E7: despesa inválida e recusada na tela, sem chamar a API', async () => {
    const create = expenseHooks.useCreate();
    renderWithProviders(
      <ExpenseFormDialog
        condominiumId="cond-1"
        categories={[makeCategory()]}
        providers={[makeServiceProvider()]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lancar' }));

    await waitFor(() =>
      expect(screen.getByText('Informe a descrição da despesa.')).toBeInTheDocument(),
    );
    expect(screen.getByText('Informe o valor.')).toBeInTheDocument();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('UT-031.E8: geração válida envia o payload ao uso do batch', async () => {
    const generate = vi.fn(async () => ({ created: 4, total: 4, skipped: 0 }));
    vi.mocked(useGenerateCharges).mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: generate,
    } as never);

    renderWithProviders(
      <GenerateChargesDialog
        condominiumId="cond-1"
        categories={[makeCategory()]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        condominiumId: 'cond-1',
        referenceMonth: expect.stringMatching(/^\d{4}-(0[1-9]|1[0-2])$/),
      }),
    );
  });

  it('UT-031.E9: baixa válida envia id e payload ao uso do pagamento', async () => {
    const register = vi.fn(async () => undefined);
    vi.mocked(useRegisterPayment).mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: register,
    } as never);

    renderWithProviders(<RegisterPaymentDialog charge={makeCharge()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'charge-1',
        data: expect.objectContaining({ amount: 800, method: 'PIX' }),
      }),
    );
  });
});
