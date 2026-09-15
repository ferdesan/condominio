/**
 * Espelho cliente de `updateTenantSchema`, em
 * `backend/src/modules/tenants/tenant.schema.ts` — **menos o que o service
 * recusa**.
 *
 * Esta e a diferenca que define o arquivo: o schema do servidor e
 * `createTenantSchema.partial()` e aceita dezesseis campos, mas
 * `tenantService.update` rejeita cinco deles com **403** quando quem pede nao e
 * super-admin:
 *
 * > `plan`, `status`, `maxCondominiums`, `maxUsers`, `slug`
 *
 * Sao decisoes comerciais — plano contratado, limites, e o identificador que
 * aparece na URL de login. Oferece-los faria todo salvamento falhar para o
 * unico papel que abre esta tela com permissao de escrita. **O schema nao e,
 * sozinho, a especificacao da tela; o service e.**
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toTenantPayload`.
 */

import { z } from 'zod';
import type { Tenant, TenantSettings } from '@/types/tenant';

const DOCUMENT_DIGITS = 14;

/** Limites de `settingsSchema` no servidor — copiados, nao inventados. */
export const GRACE_DAYS_MAX = 30;
export const PERCENT_MAX = 20;

const tenantFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Informe o nome da administradora.')
    .max(150, 'Use no maximo 150 caracteres.'),
  /** CNPJ: o servidor normaliza para digitos e exige exatamente catorze. */
  document: z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length === DOCUMENT_DIGITS, {
      message: 'CNPJ deve conter 14 digitos.',
    }),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'E-mail invalido.',
    })
    .refine((value) => value.length <= 180, { message: 'Use no maximo 180 caracteres.' }),
  /** Opcional, mas o servidor exige forma quando presente (`phoneSchema`). */
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || value.replace(/\D/g, '').length >= 8, {
      message: 'Telefone invalido.',
    })
    .refine((value) => value.length <= 20, { message: 'Use no maximo 20 caracteres.' }),
  /** O servidor exige URL absoluta quando presente; vazio limpa o campo. */
  logoUrl: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().url().safeParse(value).success, {
      message: 'Informe uma URL completa, comecando com http:// ou https://.',
    })
    .refine((value) => value.length <= 255, { message: 'Use no maximo 255 caracteres.' }),

  // -------------------------------------------------------------------------
  // Politica de encargos: os tres campos de `settings` que tem leitor
  // -------------------------------------------------------------------------

  chargeGraceDays: numericField({
    min: 0,
    max: GRACE_DAYS_MAX,
    integer: true,
    required: 'Informe os dias de carencia.',
    range: `Use um numero inteiro de 0 a ${GRACE_DAYS_MAX}.`,
  }),
  latePenaltyPercent: numericField({
    min: 0,
    max: PERCENT_MAX,
    integer: false,
    required: 'Informe o percentual de multa.',
    range: `Use um percentual de 0 a ${PERCENT_MAX}.`,
  }),
  lateInterestPercent: numericField({
    min: 0,
    max: PERCENT_MAX,
    integer: false,
    required: 'Informe o percentual de juros.',
    range: `Use um percentual de 0 a ${PERCENT_MAX}.`,
  }),
});

/**
 * Campo numerico que viaja como texto.
 *
 * Nenhum dos tres e opcional na tela, embora todos sejam no servidor: ausente,
 * `applyLateFees` usa um padrao embutido (0 dia, 2%, 1%) que ninguem ve. Um
 * campo em branco esconderia a regra que esta valendo, entao a tela sempre
 * mostra um numero — os padroes do servidor entram como valor inicial quando a
 * administradora nunca configurou nada.
 */
function numericField(options: {
  min: number;
  max: number;
  integer: boolean;
  required: string;
  range: string;
}): z.ZodEffects<z.ZodString, string, string> {
  // `superRefine`, e nao dois `refine` encadeados: cada `refine` embrulha o
  // schema numa camada nova de `ZodEffects`, e o tipo aninhado deixa de ser
  // atribuivel ao da assinatura. Uma camada so, com as duas mensagens.
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: options.required });
        return;
      }
      // Virgula decimal e o que se digita em pt-BR; `Number` nao a entende.
      const parsed = Number(value.replace(',', '.'));
      const valid =
        Number.isFinite(parsed) &&
        (!options.integer || Number.isInteger(parsed)) &&
        parsed >= options.min &&
        parsed <= options.max;
      if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: options.range });
    });
}

export const tenantSchema = tenantFields;
export type TenantFormValues = z.infer<typeof tenantSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto. */
export const TENANT_FIELDS: ReadonlySet<string> = new Set(Object.keys(tenantFields.shape));

/** Os padroes embutidos em `charge.service.ts`, para nao exibir campo vazio. */
const DEFAULT_GRACE_DAYS = 0;
const DEFAULT_PENALTY = 2;
const DEFAULT_INTEREST = 1;

export function toTenantFormValues(tenant: Tenant): TenantFormValues {
  const settings = tenant.settings ?? {};
  return {
    name: tenant.name,
    document: tenant.document ?? '',
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
    logoUrl: tenant.logoUrl ?? '',
    chargeGraceDays: String(settings.chargeGraceDays ?? DEFAULT_GRACE_DAYS),
    latePenaltyPercent: String(settings.latePenaltyPercent ?? DEFAULT_PENALTY),
    lateInterestPercent: String(settings.lateInterestPercent ?? DEFAULT_INTEREST),
  };
}

/**
 * Corpo aceito por `PATCH /tenants/me`.
 *
 * Os cinco campos comerciais **nao** estao aqui, e essa ausencia e o contrato:
 * o tipo e a garantia em tempo de compilacao de que nenhum deles chega ao
 * servidor por descuido.
 */
export type TenantPayload = {
  name: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor. */
  document: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  /** Parcial de proposito: o servidor mescla com o que ja existe. */
  settings: Pick<
    TenantSettings,
    'chargeGraceDays' | 'latePenaltyPercent' | 'lateInterestPercent'
  >;
};

/** Texto vazio vira `null`; o resto vai como digitado, so com os digitos do CNPJ. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toNumber(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

export function toTenantPayload(values: TenantFormValues): TenantPayload {
  const document = values.document.replace(/\D/g, '');
  return {
    name: values.name.trim(),
    document: document === '' ? null : document,
    email: orNull(values.email),
    phone: orNull(values.phone),
    logoUrl: orNull(values.logoUrl),
    settings: {
      chargeGraceDays: toNumber(values.chargeGraceDays),
      latePenaltyPercent: toNumber(values.latePenaltyPercent),
      lateInterestPercent: toNumber(values.lateInterestPercent),
    },
  };
}
