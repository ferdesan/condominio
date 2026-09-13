import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/** Usada quando a falha nao veio da API ou chegou sem mensagem. */
export const GENERIC_FORM_ERROR = 'Nao foi possivel concluir a operacao. Tente novamente.';

/**
 * Leva a falha da API para o formulario.
 *
 * O servidor responde 422 com `details[]` apontando o campo e 409 sem detalhe
 * nenhum — e 409 cobre tanto conflito de unicidade quanto regra de negocio, entao
 * quem separa os dois casos e a presenca do detalhe, nao o status.
 *
 * - Campo que o formulario possui: vira erro daquele campo.
 * - Sem detalhe de campo: vira a mensagem geral do formulario.
 * - Campo que o formulario nao possui: tambem vira a mensagem geral, em vez de
 *   sumir sem deixar rastro.
 *
 * Quando todos os campos apontados pertencem ao formulario, a mensagem geral e
 * limpa, para que um aviso de um envio anterior nao fique na tela.
 */
export function applyApiError<F extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<F>,
  setFormError: (message: string | null) => void,
  fields: ReadonlySet<string>,
): void {
  if (!(error instanceof ApiError)) {
    setFormError(GENERIC_FORM_ERROR);
    return;
  }

  const fieldErrors = error.fieldErrors;
  const reported = Object.keys(fieldErrors);
  const owned = reported.filter((field) => fields.has(field));

  owned.forEach((field) => {
    // O caminho vem do servidor — inclusive aninhado, como `address.city` — entao
    // nao da para conferi-lo em tempo de compilacao.
    setError(field as FieldPath<F>, { message: fieldErrors[field] });
  });

  const hasUnowned = owned.length < reported.length;
  const needsFormMessage = reported.length === 0 || hasUnowned;
  setFormError(needsFormMessage ? error.message || GENERIC_FORM_ERROR : null);
}
