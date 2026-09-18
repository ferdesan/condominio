import { describe, expect, it, vi } from 'vitest';
import type { UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';
import { GENERIC_FORM_ERROR, applyApiError } from './form-errors';

type TestForm = {
  name: string;
  document: string;
};

/** Isola o cast de `setError`, que o mock nao consegue satisfazer sozinho. */
function applyTo(error: unknown, fields: ReadonlySet<string>) {
  const setError = vi.fn();
  const setFormError = vi.fn();

  applyApiError<TestForm>(
    error,
    setError as unknown as UseFormSetError<TestForm>,
    setFormError,
    fields,
  );

  return { setError, setFormError };
}

describe('applyApiError', () => {
  it('UT-053: leva o detalhe de campo ao campo e deixa a mensagem geral nula', () => {
    const error = new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
      { field: 'document', message: 'Documento já cadastrado.' },
    ]);

    const { setError, setFormError } = applyTo(error, new Set(['name', 'document']));

    expect(setError).toHaveBeenCalledWith('document', { message: 'Documento já cadastrado.' });
    expect(setFormError).toHaveBeenCalledWith(null);
  });

  it('UT-054: um 409 sem detalhes vira mensagem geral e não toca em nenhum campo', () => {
    const error = new ApiError('Já existe um condomínio com este documento.', 409, 'CONFLICT');

    const { setError, setFormError } = applyTo(error, new Set(['name', 'document']));

    expect(setFormError).toHaveBeenCalledWith('Já existe um condomínio com este documento.');
    expect(setError).not.toHaveBeenCalled();
  });

  it('UT-055: um 422 com details vazio cai na mensagem geral', () => {
    const error = new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', []);

    const { setError, setFormError } = applyTo(error, new Set(['name', 'document']));

    expect(setFormError).toHaveBeenCalledWith('Dados invalidos.');
    expect(setError).not.toHaveBeenCalled();
  });

  it('UT-056: campo que o formulário não possui cai na mensagem geral em vez de sumir', () => {
    const error = new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
      { field: 'ownerId', message: 'Proprietário não encontrado.' },
    ]);

    const { setError, setFormError } = applyTo(error, new Set(['name', 'document']));

    expect(setError).not.toHaveBeenCalled();
    expect(setFormError).toHaveBeenCalledWith('Dados invalidos.');
  });

  it('UT-057: caminho aninhado chega a setError sem alteração', () => {
    const error = new ApiError('Dados invalidos.', 422, 'VALIDATION_ERROR', [
      { field: 'address.city', message: 'Informe a cidade.' },
    ]);

    const { setError, setFormError } = applyTo(error, new Set(['address.city']));

    expect(setError).toHaveBeenCalledWith('address.city', { message: 'Informe a cidade.' });
    expect(setFormError).toHaveBeenCalledWith(null);
  });

  it('UT-058: falha que não veio da API usa a mensagem generica, não uma string vazia', () => {
    const { setError, setFormError } = applyTo(new TypeError('Failed to fetch'), new Set(['name']));

    expect(setFormError).toHaveBeenCalledWith(GENERIC_FORM_ERROR);
    expect(GENERIC_FORM_ERROR).not.toBe('');
    expect(setError).not.toHaveBeenCalled();
  });
});
