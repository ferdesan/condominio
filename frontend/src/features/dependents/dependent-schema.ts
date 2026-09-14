/**
 * Espelho cliente de `backend/src/modules/dependents/dependent.schema.ts`.
 *
 * Mesma convencao dos schemas de morador e de unidade: todo campo entra e sai
 * como string (exceto os dois booleanos), entao `z.infer` basta e o `useForm`
 * precisa de um generico so. A conversao para o corpo da requisicao acontece em
 * `toDependentPayload`.
 *
 * Uma regra existe apenas aqui, porque o servidor nao a tem: nascimento no
 * futuro. E uma inconsistencia que ele aceitaria em silencio.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. `unitId`
 * tampouco: e a unidade do morador escolhido, e escolher outra seria descrever
 * um dependente que mora onde o responsavel dele nao mora.
 */

import { z } from 'zod';
import { DEPENDENT_RELATIONSHIPS, type Dependent } from '@/types/api';

/** Telefone opcional. A pontuacao e descartada, como o backend faz. */
function optionalPhone() {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone invalido.',
    );
}

/** Coluna `date` no servidor: o formato do input nativo ja e o que ele aceita. */
function optionalDate() {
  return z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data invalida.');
}

/**
 * Hoje em `YYYY-MM-DD` no fuso local.
 *
 * `toISOString` sozinho devolveria o dia em UTC, que em fusos negativos ainda e
 * "amanha" durante boa parte da tarde — e uma data de nascimento de hoje seria
 * recusada como futura.
 */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const dependentFields = z.object({
  residentId: z.string().min(1, 'Selecione o morador responsavel.'),
  /**
   * Nao e uma escolha: vem do morador. A exigencia esta no `superRefine`, para
   * que esquecer o morador levante uma objecao, e nao duas dizendo o mesmo.
   */
  unitId: z.string(),
  name: z.string().trim().min(3, 'Informe o nome do dependente.').max(150),
  relationship: z.enum(DEPENDENT_RELATIONSHIPS),
  document: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value === '' || value.length === 11, 'CPF deve conter 11 digitos.'),
  birthDate: optionalDate(),
  phone: optionalPhone(),
  photoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL valida.',
    ),
  hasAccessCard: z.boolean(),
  active: z.boolean(),
});

export const dependentSchema = dependentFields.superRefine((values, ctx) => {
  // O morador escolhido carrega a unidade; um morador sem ela e um registro que
  // o servidor recusaria, e a objecao pertence ao campo que ficou vazio.
  if (values.residentId !== '' && values.unitId === '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unitId'],
      message: 'O morador selecionado nao tem unidade vinculada.',
    });
  }

  if (values.birthDate && values.birthDate > todayIso()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birthDate'],
      message: 'A data de nascimento nao pode estar no futuro.',
    });
  }
});

export type DependentFormValues = z.infer<typeof dependentSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const DEPENDENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(dependentFields.shape));

export const DEPENDENT_FORM_DEFAULTS: DependentFormValues = {
  residentId: '',
  unitId: '',
  name: '',
  document: '',
  // Os padroes do schema do servidor.
  relationship: 'OTHER',
  birthDate: '',
  phone: '',
  photoUrl: '',
  hasAccessCard: false,
  active: true,
};

/** Corpo aceito por `POST /dependents`; a atualizacao e o parcial dele. */
export type DependentPayload = {
  condominiumId: string;
  unitId: string;
  residentId: string;
  name: string;
  relationship: DependentFormValues['relationship'];
  document: string | null;
  birthDate: string | null;
  phone: string | null;
  photoUrl: string | null;
  hasAccessCard: boolean;
  active: boolean;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toDependentPayload(
  values: DependentFormValues,
  condominiumId: string,
): DependentPayload {
  return {
    condominiumId,
    unitId: values.unitId,
    residentId: values.residentId,
    name: values.name,
    relationship: values.relationship,
    document: orNull(values.document),
    birthDate: orNull(values.birthDate),
    phone: orNull(values.phone),
    photoUrl: orNull(values.photoUrl),
    hasAccessCard: values.hasAccessCard,
    active: values.active,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toDependentFormValues(dependent: Dependent): DependentFormValues {
  return {
    residentId: dependent.residentId,
    unitId: dependent.unitId,
    name: dependent.name,
    relationship: dependent.relationship,
    document: dependent.document ?? '',
    birthDate: dependent.birthDate ?? '',
    phone: dependent.phone ?? '',
    photoUrl: dependent.photoUrl ?? '',
    hasAccessCard: dependent.hasAccessCard,
    active: dependent.active,
  };
}

/**
 * Prepara um termo de busca que aparenta ser documento.
 *
 * A busca do servidor cobre nome e CPF, e o CPF e guardado sem pontuacao — entao
 * `123.456.789-09` nao casaria com nada. Um termo composto so de digitos e
 * separadores e reduzido aos digitos; um nome passa intacto.
 */
export function normaliseDocument(term: string): string {
  const trimmed = term.trim();
  if (!/^[\d.\-/()\s]+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits === '' ? trimmed : digits;
}
