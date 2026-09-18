/**
 * Espelho cliente de `backend/src/modules/service-providers/service-provider.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toServiceProviderPayload`, que e onde
 * a avaliacao volta a ser numero.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 *
 * O documento e o unico campo do tier que aceita dois formatos: 11 digitos e um
 * CPF, 14 e um CNPJ, e nada entre os dois vale. O servidor faz a mesma conta e
 * ainda confere os digitos verificadores, que so ele tem como validar.
 */

import { z } from 'zod';
import { PROVIDER_STATUSES, type ServiceProvider } from '@/types/api';

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

const providerFields = z.object({
  companyName: z.string().trim().min(3, 'Informe a razao social.').max(150),
  tradeName: optionalText(150),
  document: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine(
      (value) => value === '' || value.length === 11 || value.length === 14,
      'Informe um CPF (11 digitos) ou um CNPJ (14 digitos).',
    ),
  serviceType: z.string().trim().min(2, 'Informe o tipo de serviço.').max(100),
  contactName: optionalText(150),
  phone: optionalPhone(),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      'E-mail inválido.',
    ),
  status: z.enum(PROVIDER_STATUSES),
  contractStart: optionalDate(),
  contractEnd: optionalDate(),
  // Inteiro de 1 a 5: uma classe de digito unico cobre exatamente a faixa, entao
  // 0, 6 e 10 caem aqui — antes de qualquer envio.
  rating: z
    .string()
    .refine((value) => value === '' || /^[1-5]$/.test(value), 'A avaliação vai de 1 a 5.'),
  notes: optionalText(2000),
});

export const serviceProviderSchema = providerFields.superRefine((values, ctx) => {
  // Mesma regra do servidor. Levanta-la aqui poupa a ida e volta, e a objecao
  // cai no termino, que e o campo que se corrige.
  if (values.contractStart && values.contractEnd && values.contractEnd < values.contractStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contractEnd'],
      message: 'O término do contrato não pode ser anterior ao início.',
    });
  }
});

export type ServiceProviderFormValues = z.infer<typeof serviceProviderSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const SERVICE_PROVIDER_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(providerFields.shape),
);

export const SERVICE_PROVIDER_FORM_DEFAULTS: ServiceProviderFormValues = {
  companyName: '',
  tradeName: '',
  document: '',
  serviceType: '',
  contactName: '',
  phone: '',
  email: '',
  // O padrao do servidor.
  status: 'ACTIVE',
  contractStart: '',
  contractEnd: '',
  rating: '',
  notes: '',
};

/** Corpo aceito por `POST /service-providers`; a atualizacao e o parcial dele. */
export type ServiceProviderPayload = {
  condominiumId: string;
  companyName: string;
  tradeName: string | null;
  document: string | null;
  serviceType: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: ServiceProviderFormValues['status'];
  contractStart: string | null;
  contractEnd: string | null;
  rating: number | null;
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toServiceProviderPayload(
  values: ServiceProviderFormValues,
  condominiumId: string,
): ServiceProviderPayload {
  return {
    condominiumId,
    companyName: values.companyName,
    tradeName: orNull(values.tradeName),
    document: orNull(values.document),
    serviceType: values.serviceType,
    contactName: orNull(values.contactName),
    phone: orNull(values.phone),
    email: orNull(values.email),
    status: values.status,
    contractStart: orNull(values.contractStart),
    contractEnd: orNull(values.contractEnd),
    // A coluna e `int`: a nota volta a ser numero na fronteira da requisicao.
    rating: values.rating === '' ? null : Number(values.rating),
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toServiceProviderFormValues(provider: ServiceProvider): ServiceProviderFormValues {
  return {
    companyName: provider.companyName,
    tradeName: provider.tradeName ?? '',
    document: provider.document ?? '',
    serviceType: provider.serviceType,
    contactName: provider.contactName ?? '',
    phone: provider.phone ?? '',
    email: provider.email ?? '',
    status: provider.status,
    contractStart: provider.contractStart ?? '',
    contractEnd: provider.contractEnd ?? '',
    rating: provider.rating === null ? '' : String(provider.rating),
    notes: provider.notes ?? '',
  };
}

/**
 * Prepara um termo de busca que aparenta ser documento ou telefone.
 *
 * CPFs e CNPJs sao guardados sem pontuacao, entao `12.345.678/0001-99` nao
 * casaria com nada. Um termo composto so de digitos e separadores e reduzido aos
 * digitos; qualquer outro — uma razao social, um tipo de servico — passa
 * intacto, porque a busca cobre os cinco campos de uma vez.
 */
export function normaliseDocument(term: string): string {
  const trimmed = term.trim();
  if (!/^[\d.\-/()\s]+$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits === '' ? trimmed : digits;
}
