import { describe, expect, it } from 'vitest';
import {
  BULK_GENERATE_FORM_DEFAULTS,
  bulkGenerateSchema,
  composeUnitNumber,
  longestGeneratedNumber,
  projectedUnitCount,
  type BulkGenerateFormValues,
} from './bulk-generate-schema';

function values(overrides: Partial<BulkGenerateFormValues> = {}): BulkGenerateFormValues {
  return { ...BULK_GENERATE_FORM_DEFAULTS, blockId: 'block-1', ...overrides };
}

function issueOn(input: BulkGenerateFormValues, path: string): string | undefined {
  const result = bulkGenerateSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('bulkGenerateSchema', () => {
  it('UT-010: tres andares por quatro unidades projetam doze', () => {
    expect(projectedUnitCount(3, 4)).toBe(12);
    expect(bulkGenerateSchema.safeParse(values({ floors: '3', unitsPerFloor: '4' })).success).toBe(
      true,
    );
  });

  it('UT-011: zero e 101 andares falham; 1 e 100 passam', () => {
    const message = 'O numero de andares deve estar entre 1 e 100.';
    expect(issueOn(values({ floors: '0' }), 'floors')).toBe(message);
    expect(issueOn(values({ floors: '101' }), 'floors')).toBe(message);
    expect(issueOn(values({ floors: '1' }), 'floors')).toBeUndefined();
    expect(issueOn(values({ floors: '100' }), 'floors')).toBeUndefined();
  });

  it('UT-012: a maior grade permitida projeta 5000 e passa na validacao', () => {
    expect(projectedUnitCount(100, 50)).toBe(5000);
    // Com o padrao de dois digitos no indice, o maior numero e "10050": cabe no
    // limite de 20 caracteres, entao a maior grade nao esbarra nele.
    expect(
      bulkGenerateSchema.safeParse(values({ floors: '100', unitsPerFloor: '50' })).success,
    ).toBe(true);
  });

  it('UT-013: padrao que produz numero acima de 20 caracteres falha antes do envio', () => {
    // O padrao cabe nos 30 caracteres que o servidor aceita; o que estoura e o
    // numero que ele produz, e so a combinacao com a faixa de andares revela isso.
    const pattern = 'UNIDADE-CENTRAL-{floor}{index}';
    expect(pattern.length).toBeLessThanOrEqual(30);

    // Ate o andar 10 o numero tem exatamente 20 caracteres e passa.
    const withinLimit = values({
      numberPattern: pattern,
      floors: '10',
      unitsPerFloor: '50',
      startFloor: '1',
    });
    expect(
      longestGeneratedNumber({ pattern, floors: 10, unitsPerFloor: 50, startFloor: 1 }),
    ).toBe('UNIDADE-CENTRAL-1050');
    expect(issueOn(withinLimit, 'numberPattern')).toBeUndefined();

    // Um andar de tres digitos acrescenta o caractere que derruba.
    const rejected = issueOn(
      { ...withinLimit, floors: '100', startFloor: '100' },
      'numberPattern',
    );
    expect(rejected).toContain('21 caracteres');
    expect(rejected).toContain('UNIDADE-CENTRAL-19950');
  });

  it('compoe o numero com o indice em dois digitos, como o servidor faz', () => {
    expect(composeUnitNumber('{floor}{index}', 1, 1)).toBe('101');
    expect(composeUnitNumber('{floor}{index}', 12, 4)).toBe('1204');
  });
});
