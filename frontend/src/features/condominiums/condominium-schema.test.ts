import { describe, expect, it } from 'vitest';
import {
  CONDOMINIUM_FORM_DEFAULTS,
  condominiumSchema,
  toCondominiumPayload,
  type CondominiumFormValues,
} from './condominium-schema';

function values(overrides: Partial<CondominiumFormValues> = {}): CondominiumFormValues {
  return { ...CONDOMINIUM_FORM_DEFAULTS, name: 'Residencial Aurora', ...overrides };
}

/** O primeiro erro registrado para um campo, ou `undefined` se ele passou. */
function issueOn(input: CondominiumFormValues, path: string): string | undefined {
  const result = condominiumSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('condominiumSchema', () => {
  it('UT-002: recusa nome com menos de tres caracteres apontando o campo', () => {
    expect(issueOn(values({ name: 'Ab' }), 'name')).toBe('Informe o nome do condominio.');
    expect(issueOn(values({ name: 'Abc' }), 'name')).toBeUndefined();
  });

  it('UT-003: recusa CNPJ de 13 digitos e aceita o de 14', () => {
    expect(issueOn(values({ document: '1234567800019' }), 'document')).toBe(
      'CNPJ deve conter 14 digitos.',
    );
    expect(issueOn(values({ document: '12345678000199' }), 'document')).toBeUndefined();

    // A pontuacao e descartada antes da contagem, como no backend.
    const parsed = condominiumSchema.parse(values({ document: '12.345.678/0001-99' }));
    expect(parsed.document).toBe('12345678000199');
  });

  it('UT-004: normaliza a UF para caixa alta', () => {
    expect(condominiumSchema.parse(values({ state: 'sp' })).state).toBe('SP');
  });
});

describe('toCondominiumPayload', () => {
  it('envia campo opcional limpo como vazio, e nao como chave ausente', () => {
    const payload = toCondominiumPayload(values({ phone: '', notes: '' }));

    expect(payload).toHaveProperty('phone', null);
    expect(payload).toHaveProperty('notes', null);
    expect(payload.chargeDueDay).toBe(10);
  });
});
