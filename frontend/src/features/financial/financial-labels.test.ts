import { describe, expect, it } from 'vitest';
import { openingBalanceProvenance } from './financial-labels';

describe('openingBalanceProvenance', () => {
  it('UT-123: saldo herdado nomeia a competência de onde veio', () => {
    const text = openingBalanceProvenance({ source: 'INHERITED', from: '2026-08' });

    expect(text).toBe('Herdado do fechamento de ago/2026');
  });

  it('UT-124: saldo calculado nomeia a data de corte', () => {
    const text = openingBalanceProvenance({ source: 'COMPUTED', from: '2026-01-01' });

    expect(text).toBe('Calculado a partir do saldo de abertura de 01/01/2026');
  });

  it('sem data de corte, ainda diz de onde o número veio', () => {
    const text = openingBalanceProvenance({ source: 'COMPUTED', from: null });

    expect(text).toBe('Calculado a partir do saldo de abertura do condomínio');
  });
});
