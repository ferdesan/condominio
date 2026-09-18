/**
 * Espelho cliente de `backend/src/modules/common-areas/common-area.schema.ts`.
 *
 * Mesma convencao dos demais schemas: inteiros entram e saem como texto, e a
 * conversao para o corpo da requisicao mora em `toCommonAreaPayload`. A taxa e a
 * excecao — `CurrencyInput` fala em numero — e por isso e a unica que ja chega
 * numerica ao formulario.
 *
 * As duas validacoes cruzadas sao as mesmas do servidor, com o mesmo caminho de
 * campo: ele tambem as aplica, e a copia local existe para responder antes do
 * envio, nao para substitui-lo.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 */

import { z } from 'zod';
import { COMMON_AREA_STATUSES, type CommonArea } from '@/types/api';

/** Janela diaria no formato que o servidor guarda e o input nativo produz. */
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Inteiro obrigatorio dentro de uma faixa, digitado como texto. */
function intInRange(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    );
}

const commonAreaFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da área comum.')
    .max(120, 'Use no máximo 120 caracteres.'),
  description: z.string().trim().max(2000, 'Use no máximo 2000 caracteres.'),
  status: z.enum(COMMON_AREA_STATUSES),
  capacity: intInRange(0, 10000, 'A capacidade deve estar entre 0 e 10000.'),
  photoUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.string().url().safeParse(value).success,
      'Informe uma URL válida.',
    ),

  opensAt: z.string().regex(TIME_PATTERN, 'Horario invalido. Use o formato HH:mm.'),
  closesAt: z.string().regex(TIME_PATTERN, 'Horario invalido. Use o formato HH:mm.'),
  /**
   * Nulo e lista vazia sao estados diferentes no servidor, e o formulario
   * precisa de dois controles para produzir os dois: este alternador escolhe
   * entre "todos os dias" (nulo) e "dias especificos" (a lista, que pode estar
   * vazia). Um seletor sozinho nao consegue expressar a diferenca.
   */
  allWeekdays: z.boolean(),
  weekdays: z.array(z.number().int().min(0).max(6)),

  minHours: intInRange(1, 24, 'A duração mínima deve estar entre 1 e 24 horas.'),
  maxHours: intInRange(1, 24, 'A duração máxima deve estar entre 1 e 24 horas.'),
  advanceBookingDays: intInRange(0, 365, 'A antecedência deve estar entre 0 e 365 dias.'),
  minIntervalDays: intInRange(0, 365, 'O intervalo mínimo deve estar entre 0 e 365 dias.'),
  requiresApproval: z.boolean(),

  reservationFee: z
    .number({ invalid_type_error: 'Informe um valor válido.' })
    .min(0, 'A taxa não pode ser negativa.')
    .max(999999, 'A taxa deve ser no máximo 999999.'),

  rules: z.string().trim().max(5000, 'Use no máximo 5000 caracteres.'),
});

/**
 * Horarios `HH:mm` comparam corretamente como texto — formato de tamanho fixo,
 * ordenado do campo mais significativo para o menos —, que e como o servidor os
 * compara. As duas objecoes caem no campo que o servidor tambem aponta.
 */
export const commonAreaSchema = commonAreaFields.superRefine((values, ctx) => {
  if (TIME_PATTERN.test(values.opensAt) && TIME_PATTERN.test(values.closesAt)) {
    if (values.closesAt <= values.opensAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['closesAt'],
        message: 'O horário de fechamento deve ser posterior ao de abertura.',
      });
    }
  }

  const min = Number(values.minHours);
  const max = Number(values.maxHours);
  if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxHours'],
      message: 'A duração máxima deve ser maior ou igual a mínima.',
    });
  }
});

export type CommonAreaFormValues = z.infer<typeof commonAreaSchema>;

/**
 * Nomes que o formulario possui — `applyApiError` usa isto para decidir o
 * destino da mensagem. `availableWeekdays` fica de fora de proposito: o
 * formulario o expressa em dois controles, entao uma objecao do servidor sobre
 * ele vira mensagem geral em vez de sumir num campo que nao existe.
 */
export const COMMON_AREA_FIELDS: ReadonlySet<string> = new Set(Object.keys(commonAreaFields.shape));

/** Os padroes do servidor, para que cadastrar sem mexer em nada grave o mesmo. */
export const COMMON_AREA_FORM_DEFAULTS: CommonAreaFormValues = {
  name: '',
  description: '',
  status: 'AVAILABLE',
  capacity: '0',
  photoUrl: '',
  opensAt: '08:00',
  closesAt: '22:00',
  allWeekdays: true,
  weekdays: [],
  minHours: '1',
  maxHours: '6',
  advanceBookingDays: '60',
  minIntervalDays: '0',
  requiresApproval: true,
  reservationFee: 0,
  rules: '',
};

export const COMMON_AREA_STATUS_LABELS: Record<CommonArea['status'], string> = {
  AVAILABLE: 'Disponível',
  MAINTENANCE: 'Em manutenção',
  BLOCKED: 'Bloqueada',
};

/** Domingo primeiro, como o servidor numera (0 = domingo). */
export const WEEKDAYS: ReadonlyArray<{ value: number; label: string; short: string }> = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sab' },
];

/** Corpo aceito por `POST /common-areas`; a atualizacao e o parcial dele. */
export type CommonAreaPayload = {
  condominiumId: string;
  name: string;
  description: string | null;
  capacity: number;
  status: CommonAreaFormValues['status'];
  requiresApproval: boolean;
  reservationFee: number;
  opensAt: string;
  closesAt: string;
  availableWeekdays: number[] | null;
  minHours: number;
  maxHours: number;
  advanceBookingDays: number;
  minIntervalDays: number;
  photoUrl: string | null;
  rules: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toCommonAreaPayload(
  values: CommonAreaFormValues,
  condominiumId: string,
): CommonAreaPayload {
  return {
    condominiumId,
    name: values.name,
    description: orNull(values.description),
    capacity: Number(values.capacity),
    status: values.status,
    requiresApproval: values.requiresApproval,
    reservationFee: values.reservationFee,
    opensAt: values.opensAt,
    closesAt: values.closesAt,
    // Nulo libera a semana inteira; a lista — inclusive vazia — e uma restricao
    // explicita. Colapsar os dois em um so apagaria a diferenca.
    availableWeekdays: values.allWeekdays ? null : [...values.weekdays].sort((a, b) => a - b),
    minHours: Number(values.minHours),
    maxHours: Number(values.maxHours),
    advanceBookingDays: Number(values.advanceBookingDays),
    minIntervalDays: Number(values.minIntervalDays),
    photoUrl: orNull(values.photoUrl),
    rules: orNull(values.rules),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toCommonAreaFormValues(area: CommonArea): CommonAreaFormValues {
  return {
    name: area.name,
    description: area.description ?? '',
    status: area.status,
    capacity: String(area.capacity),
    photoUrl: area.photoUrl ?? '',
    opensAt: area.opensAt,
    closesAt: area.closesAt,
    allWeekdays: area.availableWeekdays === null || area.availableWeekdays === undefined,
    weekdays: area.availableWeekdays ?? [],
    minHours: String(area.minHours),
    maxHours: String(area.maxHours),
    advanceBookingDays: String(area.advanceBookingDays),
    minIntervalDays: String(area.minIntervalDays),
    requiresApproval: area.requiresApproval,
    reservationFee: area.reservationFee,
    rules: area.rules ?? '',
  };
}

/** Resumo dos dias liberados para a listagem. Nulo e a semana inteira. */
export function weekdaysLabel(weekdays: number[] | null): string {
  if (weekdays === null) return 'Todos os dias';
  if (weekdays.length === 0) return 'Nenhum dia';
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.short ?? String(day))
    .join(', ');
}
