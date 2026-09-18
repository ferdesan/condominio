import { describe, expect, it } from 'vitest';
import { UNIT_FORM_DEFAULTS, unitSchema, type UnitFormValues } from './unit-schema';

function values(overrides: Partial<UnitFormValues> = {}): UnitFormValues {
  return { ...UNIT_FORM_DEFAULTS, blockId: 'block-1', number: '101', ...overrides };
}

/** O primeiro erro registrado para um campo, ou `undefined` se ele passou. */
function issueOn(input: UnitFormValues, path: string): string | undefined {
  const result = unitSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('unitSchema', () => {
  it('UT-009: andar 201 e fração 1.5 falham cada um no próprio caminho', () => {
    expect(issueOn(values({ floor: '201' }), 'floor')).toBe('O andar deve estar entre -10 e 200.');
    expect(issueOn(values({ idealFraction: '1.5' }), 'idealFraction')).toBe(
      'A fração ideal deve estar entre 0 e 1.',
    );

    // Um erro nao contamina o outro campo.
    expect(issueOn(values({ floor: '201' }), 'idealFraction')).toBeUndefined();
    expect(issueOn(values({ idealFraction: '1.5' }), 'floor')).toBeUndefined();

    // As bordas da faixa do servidor passam.
    expect(issueOn(values({ floor: '200' }), 'floor')).toBeUndefined();
    expect(issueOn(values({ floor: '-10' }), 'floor')).toBeUndefined();
    expect(issueOn(values({ idealFraction: '1' }), 'idealFraction')).toBeUndefined();
    expect(issueOn(values({ idealFraction: '0' }), 'idealFraction')).toBeUndefined();
  });
});
