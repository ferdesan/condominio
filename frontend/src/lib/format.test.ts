import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDocument, formatPhone } from './format';

/** Placeholder neutro usado em todos os formatadores. */
const PLACEHOLDER = '—';

describe('format', () => {
  it('UT-086: formatDocument(null) devolve o placeholder, nao a palavra null', () => {
    expect(formatDocument(null)).toBe(PLACEHOLDER);
    expect(formatDocument(null)).not.toContain('null');
  });

  it('UT-087: formatPhone devolve o placeholder para null e para string vazia', () => {
    expect(formatPhone(null)).toBe(PLACEHOLDER);
    expect(formatPhone('')).toBe(PLACEHOLDER);
  });

  it('UT-088: formatDocument formata 11 digitos como pessoa e 14 como empresa', () => {
    expect(formatDocument('12345678909')).toBe('123.456.789-09');
    expect(formatDocument('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('UT-089: formatCurrency(0) devolve zero formatado, nao o placeholder', () => {
    const formatted = formatCurrency(0);

    expect(formatted).not.toBe(PLACEHOLDER);
    expect(formatted).toContain('0,00');
  });

  it('UT-090: formatDate com data invalida devolve o placeholder em vez de lancar', () => {
    expect(() => formatDate('nao-e-uma-data')).not.toThrow();
    expect(formatDate('nao-e-uma-data')).toBe(PLACEHOLDER);
  });
});
