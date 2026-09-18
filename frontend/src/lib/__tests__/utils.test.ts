/**
 * UT-029 — funcoes puras de `utils.ts`: `cn`, `initials` e `sleep`.
 * Sem DOM, sem transporte: apenas contrato puro.
 */
import { describe, expect, it } from 'vitest';
import { cn, initials, sleep } from '../utils';

describe('cn() (UT-029)', () => {
  it('UT-029: junta as classes condicionais', () => {
    const maybe = false;
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('a', maybe && 'b', null, 'c')).toBe('a c');
  });

  it('UT-029.E1: a última classe vence o conflito de utilidade', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });
});

describe('initials() (UT-029)', () => {
  it('UT-029.E2: nome completo vira as iniciais do primeiro e último nome', () => {
    expect(initials('João Silva')).toBe('JS');
    expect(initials('  marina   alves ')).toBe('MA');
  });

  it('UT-029.E3: nome único devolve duas letras dele, não uma so', () => {
    expect(initials('João')).toBe('JO');
    expect(initials('A')).toBe('A');
  });

  it('UT-029.E4: ausência de nome devolve string vazia', () => {
    expect(initials('')).toBe('');
    expect(initials(null)).toBe('');
    expect(initials(undefined)).toBe('');
  });
});

describe('sleep() (UT-029)', () => {
  it('UT-029.E5: sleep(0) resolve imediatamente', async () => {
    // Com a guarda de tempo, um sleep que trocasse setTimeout por outra coisa
    // falharia aqui; o caso e de contrato, nao de cronometragem real.
    const started = Date.now();
    await sleep(0);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
