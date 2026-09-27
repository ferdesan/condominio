/**
 * Correcao da data de uma baixa (recebimento e liquidacao).
 *
 * O dialogo nao decide se um mes esta fechado — o servidor decide e a recusa
 * dele aparece na tela. O que se prova aqui e o contrato com a API, a validacao
 * do motivo, o aviso de troca de competencia e quem ve a acao.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/render';
import { ApiError, apiGetPaginated, apiPatch } from '@/lib/api';
import { makeMeta } from '@/test/fixtures';
import { CorrectPaidAtDialog } from './components/correct-paid-at-dialog';
import { ChargePaymentsDialog } from './components/charge-payments-dialog';
import { competenceOf } from './financial-schema';
import { makeCharge, makePayment } from './test-utils';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiGetPaginated: vi.fn(), apiPatch: vi.fn() };
});

const REASON = 'Data lançada errada no extrato';

const target = {
  kind: 'expense' as const,
  id: 'expense-1',
  paidAt: '2026-03-15T15:00:00.000Z',
  amount: 250,
  description: 'Conta de energia',
};

function fillAndSubmit(paidAt: string, reason = REASON) {
  fireEvent.change(screen.getByLabelText(/pago em/i), { target: { value: paidAt } });
  fireEvent.change(screen.getByLabelText(/motivo da correção/i), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Corrigir data' }));
}

describe('CorrectPaidAtDialog', () => {
  beforeEach(() => {
    vi.mocked(apiPatch).mockReset();
  });

  it('envia a nova data e o motivo para a rota da despesa', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const onClose = vi.fn();
    renderWithProviders(<CorrectPaidAtDialog target={target} onClose={onClose} />);

    fillAndSubmit('2026-03-18T10:00');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiPatch).toHaveBeenCalledWith('/financial/expenses/expense-1/paid-at', {
      paidAt: new Date('2026-03-18T10:00').toISOString(),
      reason: REASON,
    });
  });

  it('usa a rota de pagamentos para recebimento', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    renderWithProviders(
      <CorrectPaidAtDialog target={{ ...target, kind: 'payment', id: 'payment-9' }} onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/recebido em/i), {
      target: { value: '2026-03-18T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/motivo da correção/i), { target: { value: REASON } });
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir data' }));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/financial/payments/payment-9/paid-at', expect.anything()),
    );
  });

  it('exige motivo com pelo menos 10 caracteres', async () => {
    renderWithProviders(<CorrectPaidAtDialog target={target} onClose={vi.fn()} />);

    fillAndSubmit('2026-03-18T10:00', 'erro');

    expect(await screen.findByText(/mínimo de 10 caracteres/i)).toBeInTheDocument();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('avisa quando a correcao troca a competencia', () => {
    renderWithProviders(<CorrectPaidAtDialog target={target} onClose={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/pago em/i), { target: { value: '2026-04-02T10:00' } });

    expect(screen.getByRole('status')).toHaveTextContent('sai do balancete de 2026-03');
    expect(screen.getByRole('status')).toHaveTextContent('entra no de 2026-04');
  });

  it('mostra a recusa do servidor quando ha mes fechado', async () => {
    vi.mocked(apiPatch).mockRejectedValue(
      new ApiError(
        'A competencia 2026-03 esta fechada. Reabra o mes para corrigir a data.',
        409,
        'BUSINESS_RULE_VIOLATION',
      ),
    );
    const onClose = vi.fn();
    renderWithProviders(<CorrectPaidAtDialog target={target} onClose={onClose} />);

    fillAndSubmit('2026-04-02T10:00');

    expect(await screen.findByRole('alert')).toHaveTextContent('2026-03 esta fechada');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('competenceOf', () => {
  it('usa o fuso do negocio, e nao o do navegador', () => {
    // 31/08 as 22h em Brasilia ja e 01/09 em UTC: o servidor conta em agosto.
    expect(competenceOf('2026-09-01T01:00:00.000Z')).toBe('2026-08');
    expect(competenceOf('2026-09-01T03:00:00.000Z')).toBe('2026-09');
  });
});

describe('ChargePaymentsDialog — acao de corrigir data', () => {
  beforeEach(() => {
    vi.mocked(apiGetPaginated).mockResolvedValue({
      data: [makePayment()],
      meta: makeMeta({ total: 1 }),
    });
  });

  it('aparece para quem tem payment:update', async () => {
    renderWithProviders(<ChargePaymentsDialog charge={makeCharge()} onClose={vi.fn()} />, {
      permissions: ['payment:read', 'payment:update'],
    });

    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByRole('button', { name: /corrigir data do recebimento/i }),
    ).toBeInTheDocument();
  });

  it('nao aparece sem payment:update', async () => {
    renderWithProviders(<ChargePaymentsDialog charge={makeCharge()} onClose={vi.fn()} />, {
      permissions: ['payment:read'],
    });

    await screen.findByText(/total recebido/i);
    expect(
      screen.queryByRole('button', { name: /corrigir data do recebimento/i }),
    ).not.toBeInTheDocument();
  });

  it('nao aparece em cobranca cancelada', async () => {
    renderWithProviders(
      <ChargePaymentsDialog charge={makeCharge({ status: 'CANCELED' })} onClose={vi.fn()} />,
      { permissions: ['payment:read', 'payment:update'] },
    );

    await screen.findByText(/total recebido/i);
    expect(
      screen.queryByRole('button', { name: /corrigir data do recebimento/i }),
    ).not.toBeInTheDocument();
  });
});
