import { describe, expect, it } from 'vitest';
import { residentFilters } from '@/lib/crud';
import {
  normaliseDocument,
  RESIDENT_FORM_DEFAULTS,
  residentSchema,
  type ResidentFormValues,
} from './resident-schema';

/** Valores minimos que passam, para que cada caso mude apenas o que investiga. */
function valid(overrides: Partial<ResidentFormValues> = {}): ResidentFormValues {
  return { ...RESIDENT_FORM_DEFAULTS, unitId: 'unit-1', name: 'Carlos Pereira', ...overrides };
}

/** Caminhos apontados pelas issues, na ordem em que o Zod as reporta. */
function issuePaths(values: ResidentFormValues): string[] {
  const result = residentSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('Filtros de morador', () => {
  it('UT-014: a whitelist e exatamente condominiumId, unitId, type, status e userId', () => {
    expect([...residentFilters]).toEqual(['condominiumId', 'unitId', 'type', 'status', 'userId']);
  });
});

describe('Normalizacao do termo de busca', () => {
  it('UT-015: um CPF pontuado vira apenas digitos antes de ser enviado', () => {
    expect(normaliseDocument('123.456.789-09')).toBe('12345678909');
  });

  it('um nome atravessa intacto: a busca cobre quatro campos de uma vez', () => {
    expect(normaliseDocument('Carlos Pereira')).toBe('Carlos Pereira');
  });

  it('um telefone pontuado tambem vira digitos: e guardado sem pontuacao', () => {
    expect(normaliseDocument('(11) 97777-6666')).toBe('11977776666');
  });
});

describe('Schema do morador', () => {
  it('UT-023: um nome de dois caracteres falha no caminho name', () => {
    const result = residentSchema.safeParse(valid({ name: 'Jo' }));

    expect(result.success).toBe(false);
    expect(issuePaths(valid({ name: 'Jo' }))).toContain('name');
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Informe o nome do morador.');
    }
  });

  it('UT-024: uma saida anterior a entrada falha no caminho moveOutDate', () => {
    const values = valid({ moveInDate: '2026-03-10', moveOutDate: '2026-03-09' });

    expect(issuePaths(values)).toEqual(['moveOutDate']);
  });

  it('UT-024: uma saida posterior a entrada passa', () => {
    expect(issuePaths(valid({ moveInDate: '2026-03-10', moveOutDate: '2026-03-11' }))).toEqual([]);
  });

  it('UT-025: uma data de nascimento no futuro falha no caminho birthDate', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    expect(issuePaths(valid({ birthDate: future }))).toEqual(['birthDate']);
  });

  it('UT-025: uma data de nascimento passada passa', () => {
    expect(issuePaths(valid({ birthDate: '1985-06-20' }))).toEqual([]);
  });

  it('quem consta como mudado precisa da data de saida', () => {
    expect(issuePaths(valid({ status: 'MOVED_OUT', moveOutDate: '' }))).toEqual(['moveOutDate']);
    expect(issuePaths(valid({ status: 'MOVED_OUT', moveOutDate: '2026-03-11' }))).toEqual([]);
  });

  it('CPF e e-mail sao opcionais, e o CPF chega ao servidor sem pontuacao', () => {
    expect(issuePaths(valid({ document: '', email: '' }))).toEqual([]);

    const result = residentSchema.safeParse(valid({ document: '123.456.789-09' }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.document).toBe('12345678909');
  });
});
