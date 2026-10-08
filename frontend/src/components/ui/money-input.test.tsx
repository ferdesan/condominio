import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createUser } from '@/test/render';
import { formatCurrency } from '@/lib/format';
import { MoneyInput } from './money-input';

/** Formulario minimo: o que a mascara mostra e o que o formulario guarda. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MoneyInput aria-label="Valor" value={value} onChange={setValue} />
      <span data-testid="emitted">{value}</span>
    </>
  );
}

function field(): HTMLInputElement {
  return screen.getByLabelText('Valor') as HTMLInputElement;
}

function emitted(): string {
  return screen.getByTestId('emitted').textContent ?? '';
}

// O bug que motivou o componente: `type="number"` engole a virgula e manda
// `150050` no corpo, cem vezes o valor. A regressao central e o conteudo que a
// digitacao produz — se a mascara recalcular errado, o dinheiro errado vai ao
// servidor.
describe('MoneyInput', () => {
  it('e um text com teclado decimal: a virgula sobrevive ao campo', () => {
    render(<MoneyInput aria-label="Valor" />);

    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'decimal');
  });

  it('sem virgula os digitos sao centavos: 4999 vira R$ 49,99', async () => {
    const user = createUser();
    render(<Harness />);

    await user.type(field(), '4999');

    expect(field()).toHaveValue(formatCurrency(49.99));
    // O que sai e decimal canonico, nao a string formatada da tela.
    expect(emitted()).toBe('49.99');
  });

  it('com virgula os digitos sao reais: 1500,50 vira R$ 1.500,50', async () => {
    const user = createUser();
    render(<Harness />);

    await user.type(field(), '1500,50');

    expect(field()).toHaveValue(formatCurrency(1500.5));
    expect(emitted()).toBe('1500.50');
  });

  it('valor vindo de fora aparece formatado, e trocar depois reformata', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MoneyInput aria-label="Valor" value="800" onChange={onChange} />);

    expect(field()).toHaveValue(formatCurrency(800));

    rerender(<MoneyInput aria-label="Valor" value="0.5" onChange={onChange} />);
    expect(field()).toHaveValue(formatCurrency(0.5));

    // O reset para vazio: campo em branco, e nao `R$ 0,00` fantasma.
    rerender(<MoneyInput aria-label="Valor" value="" onChange={onChange} />);
    expect(field()).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('limpar o campo emite texto vazio, nao zero', async () => {
    const user = createUser();
    render(<Harness initial="800" />);

    expect(field()).toHaveValue(formatCurrency(800));
    await user.clear(field());

    expect(field()).toHaveValue('');
    expect(emitted()).toBe('');
  });

  it('no repouso as duas casas aparecem sozinhas, sem mudar o valor', async () => {
    const user = createUser();
    const onChange = vi.fn();
    render(<MoneyInput aria-label="Valor" value="" onChange={onChange} />);

    // Digitado: a virgula corta e o resto ainda nao veio.
    await user.type(field(), '1500,5');
    expect(field().value).toMatch(/1\.500,5$/);
    const emissions = onChange.mock.calls.length;

    await user.tab();

    // A formatacao de repouso reescreve so a apresentacao: nem novo valor, e
    // nem as duas casas mudam o que o formulario guarda.
    expect(field()).toHaveValue(formatCurrency(1500.5));
    expect(onChange).toHaveBeenCalledTimes(emissions);
    expect(onChange).toHaveBeenLastCalledWith('1500.50');
  });

  it('recusa valor alem do teto do servidor devolvendo o que ja estava', async () => {
    const user = createUser();
    render(<Harness />);

    // O teto do `moneySchema`: 99.999.999,99 — que sao 10 digitos de centavos.
    await user.type(field(), '9999999999');
    expect(field()).toHaveValue(formatCurrency(99_999_999.99));
    expect(emitted()).toBe('99999999.99');

    // O digito que passa do teto nao entra: o campo volta ao que valia.
    await user.type(field(), '9');
    expect(field()).toHaveValue(formatCurrency(99_999_999.99));
    expect(emitted()).toBe('99999999.99');
  });

  it('editar um valor existente: limpar e digitar de novo segue a mesma regra', async () => {
    const user = createUser();
    render(<Harness initial="800" />);

    expect(field()).toHaveValue(formatCurrency(800));
    await user.clear(field());
    await user.type(field(), '4999,00');

    expect(field()).toHaveValue(formatCurrency(4999));
    expect(emitted()).toBe('4999.00');
  });
});
