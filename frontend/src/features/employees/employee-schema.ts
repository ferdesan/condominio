/**
 * Espelho cliente de `backend/src/modules/employees/employee.schema.ts`.
 *
 * Quase todo campo entra e sai como string, como nos schemas de morador e de
 * unidade. `salary` e a excecao: o `CurrencyInput` emite numero, entao guardar o
 * campo como texto obrigaria a converter duas vezes por tecla. A conversao para
 * o corpo da requisicao acontece em `toEmployeePayload`.
 *
 * A ordem das datas contratuais e a unica regra do `EmployeeService` espelhada
 * aqui, para poupar a viagem de ida e volta de uma objecao que ja da para
 * levantar na hora. A validade do digito verificador do CPF continua sendo do
 * servidor, que e quem a calcula; e o desligamento sem data tambem, porque quem
 * a preenche com a de hoje e ele.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. `userId`
 * tampouco: nao existe tela de usuarios para escolher um.
 */

import { z } from 'zod';
import { EMPLOYEE_CONTRACT_TYPES, EMPLOYEE_STATUSES, type Employee } from '@/types/api';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
}

/** Telefone opcional. A pontuacao e descartada, como o backend faz. */
function optionalPhone() {
  return z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || (value.length >= 8 && value.length <= 11),
      'Telefone inválido.',
    );
}

/** Coluna `date` no servidor: o formato do input nativo ja e o que ele aceita. */
function optionalDate() {
  return z
    .string()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data inválida.');
}

/** Teto do schema do servidor para `salary`. */
export const EMPLOYEE_MAX_SALARY = 9_999_999;

const employeeFields = z.object({
  name: z.string().trim().min(3, 'Informe o nome do funcionário.').max(150),
  document: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value === '' || value.length === 11, 'CPF deve conter 11 digitos.'),
  position: z.string().trim().min(2, 'Informe o cargo.').max(100),
  department: optionalText(100),
  contractType: z.enum(EMPLOYEE_CONTRACT_TYPES),
  status: z.enum(EMPLOYEE_STATUSES),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'E-mail inválido.',
    ),
  phone: optionalPhone(),
  admissionDate: optionalDate(),
  terminationDate: optionalDate(),
  workSchedule: optionalText(120),
  /** Ausente e `undefined`, e nao zero: sem salario informado nao e salario zero. */
  salary: z
    .number()
    .min(0, 'O salário não pode ser negativo.')
    .max(EMPLOYEE_MAX_SALARY, `O salário deve ser no máximo ${EMPLOYEE_MAX_SALARY}.`)
    .optional(),
  photoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL válida.',
    ),
  notes: optionalText(2000),
});

export const employeeSchema = employeeFields.superRefine((values, ctx) => {
  // Datas `YYYY-MM-DD` comparam corretamente como texto: o formato e de tamanho
  // fixo e ordenado do campo mais significativo para o menos.
  if (
    values.admissionDate &&
    values.terminationDate &&
    values.terminationDate < values.admissionDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminationDate'],
      message: 'A data de desligamento não pode ser anterior a admissao.',
    });
  }
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const EMPLOYEE_FIELDS: ReadonlySet<string> = new Set(Object.keys(employeeFields.shape));

export const EMPLOYEE_FORM_DEFAULTS: EmployeeFormValues = {
  name: '',
  document: '',
  position: '',
  department: '',
  // Os padroes do schema do servidor.
  contractType: 'CLT',
  status: 'ACTIVE',
  email: '',
  phone: '',
  admissionDate: '',
  terminationDate: '',
  workSchedule: '',
  salary: undefined,
  photoUrl: '',
  notes: '',
};

/** Corpo aceito por `POST /employees`; a atualizacao e o parcial dele. */
export type EmployeePayload = {
  condominiumId: string;
  name: string;
  document: string | null;
  position: string;
  department: string | null;
  contractType: EmployeeFormValues['contractType'];
  status: EmployeeFormValues['status'];
  email: string | null;
  phone: string | null;
  admissionDate: string | null;
  terminationDate: string | null;
  workSchedule: string | null;
  salary: number | null;
  photoUrl: string | null;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toEmployeePayload(
  values: EmployeeFormValues,
  condominiumId: string,
): EmployeePayload {
  return {
    condominiumId,
    name: values.name,
    document: orNull(values.document),
    position: values.position,
    department: orNull(values.department),
    contractType: values.contractType,
    status: values.status,
    email: orNull(values.email),
    phone: orNull(values.phone),
    admissionDate: orNull(values.admissionDate),
    terminationDate: orNull(values.terminationDate),
    workSchedule: orNull(values.workSchedule),
    // O campo monetario ja e numero; o que falta e distinguir vazio de zero.
    salary: values.salary ?? null,
    photoUrl: orNull(values.photoUrl),
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toEmployeeFormValues(employee: Employee): EmployeeFormValues {
  return {
    name: employee.name,
    document: employee.document ?? '',
    position: employee.position,
    department: employee.department ?? '',
    contractType: employee.contractType,
    status: employee.status,
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    admissionDate: employee.admissionDate ?? '',
    terminationDate: employee.terminationDate ?? '',
    workSchedule: employee.workSchedule ?? '',
    salary: employee.salary ?? undefined,
    photoUrl: employee.photoUrl ?? '',
    notes: employee.notes ?? '',
  };
}

/**
 * Prepara um termo de busca que aparenta ser documento.
 *
 * A busca do servidor cobre nome, CPF, cargo e e-mail, e o CPF e guardado sem
 * pontuacao — entao `123.456.789-09` nao casaria com nada. Um termo composto so
 * de digitos e separadores e reduzido aos digitos; qualquer outro passa intacto.
 */
export function normaliseDocument(term: string): string {
  const trimmed = term.trim();
  if (!/^[\d.\-/()\s]+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits === '' ? trimmed : digits;
}
