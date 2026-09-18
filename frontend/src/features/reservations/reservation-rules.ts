/**
 * Regras locais de reserva (ADR-011).
 *
 * Oito das dez regras que o servidor aplica sao decidiveis aqui, porque todos
 * os parametros que elas leem estao no registro da area comum. As outras duas —
 * sobreposicao com outra reserva e intervalo minimo da mesma unidade — dependem
 * de estado que o cliente nao tem e nao consegue ler junto com o envio, entao
 * **nao** sao verificadas aqui: sao recusas normais vindas do servidor.
 *
 * As regras sao derivadas do registro da area em tempo de execucao, e nao
 * escritas como constantes: mudar um parametro no servidor muda o formulario
 * sem mexer neste arquivo.
 *
 * Espelho de `backend/src/modules/reservations/reservation.service.ts`. As
 * mensagens sao as mesmas do servidor de proposito — a mesma regra nao deve
 * mudar de texto conforme quem a respondeu.
 */

import { addDays, differenceInMinutes, getDay, isValid, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';
import type { CommonArea } from '@/types/api';

export const NOTES_MAX = 1000;
export const DECISION_REASON_MAX = 255;

export type ReservationFormValues = {
  commonAreaId: string;
  unitId: string;
  /** Formato do input nativo: `yyyy-MM-ddTHH:mm`, sempre em hora local. */
  startsAt: string;
  endsAt: string;
  guestsCount: string;
  notes: string;
};

/** Campos que uma regra local sabe apontar. */
export type RuleField = 'startsAt' | 'endsAt' | 'guestsCount';

export type RuleIssue = {
  field: RuleField;
  message: string;
};

/**
 * Le o campo de data e hora do formulario.
 *
 * Sem fuso no texto, o motor interpreta como hora local — que e exatamente como
 * o servidor compara a janela de funcionamento (ADR-011).
 */
function parseLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** `HH:mm` -> minutos desde a meia-noite. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Fechar as 00:00 significa fechar no fim do dia, e nao no comeco dele. */
function closingMinutes(area: CommonArea): number {
  return area.closesAt === '00:00' ? 1440 : toMinutes(area.closesAt);
}

const WEEKDAY_NAMES = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const;

/**
 * Texto das restricoes da area, para o formulario mostrar antes do envio.
 * Cada item e uma frase curta; a lista inteira e o que o usuario precisa saber
 * para acertar de primeira.
 */
export function describeAreaRules(area: CommonArea): string[] {
  const rules: string[] = [`Funcionamento das ${area.opensAt} as ${area.closesAt}.`];

  const weekdays = area.availableWeekdays;
  if (weekdays?.length) {
    const names = weekdays.map((day) => WEEKDAY_NAMES[day] ?? String(day));
    rules.push(`Dias permitidos: ${names.join(', ')}.`);
  } else {
    rules.push('Disponível todos os dias da semana.');
  }

  if (area.minHours > 0) rules.push(`Duração mínima de ${area.minHours}h.`);
  if (area.maxHours > 0) rules.push(`Duração máxima de ${area.maxHours}h.`);
  rules.push(`Antecedência máxima de ${area.advanceBookingDays} dias.`);
  if (area.capacity > 0) rules.push(`Capacidade de ${area.capacity} pessoas.`);
  if (area.minIntervalDays > 0) {
    rules.push(
      `Intervalo mínimo de ${area.minIntervalDays} dia(s) entre reservas da mesma unidade.`,
    );
  }
  rules.push(
    area.requiresApproval
      ? 'Esta área exige aprovação: a reserva nasce pendente.'
      : 'Esta área não exige aprovação: a reserva já nasce confirmada.',
  );

  return rules;
}

/**
 * Aplica as oito regras locais.
 *
 * Sem area escolhida, so a relacao entre inicio e termino da para conferir —
 * todas as demais leem um parametro que ainda nao existe.
 *
 * A ordem segue a do servidor, para que a primeira mensagem que o usuario ve
 * seja a mesma que ele veria se tivesse enviado.
 */
export function checkReservationRules(
  values: Pick<ReservationFormValues, 'startsAt' | 'endsAt' | 'guestsCount'>,
  area: CommonArea | null | undefined,
  now: Date = new Date(),
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const start = parseLocal(values.startsAt);
  const end = parseLocal(values.endsAt);

  if (!start || !end) return issues;

  // 1. Termino depois do inicio. Unica regra que nao depende da area.
  if (end <= start) {
    issues.push({ field: 'endsAt', message: 'O término deve ser posterior ao início.' });
    return issues;
  }

  if (!area) return issues;

  // 2. Nada no passado.
  if (start < now) {
    issues.push({ field: 'startsAt', message: 'Não e possível reservar uma data no passado.' });
  }

  // 3. Limite de antecedencia.
  if (start > addDays(now, area.advanceBookingDays)) {
    issues.push({
      field: 'startsAt',
      message: `Reservas podem ser feitas com no máximo ${area.advanceBookingDays} dias de antecedência.`,
    });
  }

  // 4 e 5. Duracao. Um limite zerado nao limita nada.
  const durationHours = differenceInMinutes(end, start) / 60;
  if (area.minHours > 0 && durationHours < area.minHours) {
    issues.push({
      field: 'endsAt',
      message: `A reserva mínima para esta área e de ${area.minHours}h.`,
    });
  }
  if (area.maxHours > 0 && durationHours > area.maxHours) {
    issues.push({
      field: 'endsAt',
      message: `A reserva máxima para esta área e de ${area.maxHours}h.`,
    });
  }

  // 6. Dia da semana, lido do inicio: uma reserva que cruza a meia-noite
  // pertence ao dia em que comecou. Lista vazia ou ausente libera a semana.
  const weekdays = area.availableWeekdays;
  if (weekdays?.length && !weekdays.includes(getDay(start))) {
    issues.push({
      field: 'startsAt',
      message: 'A área comum não esta disponível neste dia da semana.',
    });
  }

  // 7. Janela de funcionamento, contada a partir do inicio do dia da reserva.
  // `endMinutes` passa de 1440 quando a reserva cruza a meia-noite, o que so
  // cabe em areas que fecham exatamente as 00:00.
  const dayStart = startOfDay(start);
  const opens = toMinutes(area.opensAt);
  const closes = closingMinutes(area);
  const startMinutes = differenceInMinutes(start, dayStart);
  const endMinutes = differenceInMinutes(end, dayStart);
  const window = `Reservas permitidas somente entre ${area.opensAt} e ${area.closesAt}.`;
  if (startMinutes < opens) issues.push({ field: 'startsAt', message: window });
  if (endMinutes > closes) issues.push({ field: 'endsAt', message: window });

  // 8. Capacidade. Capacidade zero significa "sem limite declarado".
  const guests = Number(values.guestsCount);
  if (area.capacity > 0 && Number.isFinite(guests) && guests > area.capacity) {
    issues.push({
      field: 'guestsCount',
      message: `A área comporta no máximo ${area.capacity} pessoas.`,
    });
  }

  // Sobreposicao e intervalo minimo ficam de fora: ADR-011.
  return issues;
}

const baseSchema = z.object({
  commonAreaId: z.string().min(1, 'Selecione a área comum.'),
  unitId: z.string().min(1, 'Selecione a unidade.'),
  startsAt: z.string().min(1, 'Informe a data e hora de início.'),
  endsAt: z.string().min(1, 'Informe a data e hora de término.'),
  guestsCount: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) <= 10000),
      'Informe um número de convidados válido.',
    ),
  notes: z.string().trim().max(NOTES_MAX, `Use no máximo ${NOTES_MAX} caracteres.`),
});

export type ReservationSchema = z.ZodType<ReservationFormValues>;

/**
 * Monta o schema do formulario para a area escolhida.
 *
 * Reconstrua-o sempre que a area mudar: as regras sao parametrizadas por ela, e
 * um envio valido para a area anterior precisa ser reavaliado.
 *
 * `now` e uma funcao, e nao uma data: o formulario pode ficar aberto por
 * minutos, e "passado" precisa ser medido no envio, nao na montagem.
 */
export function buildReservationSchema(
  area: CommonArea | null | undefined,
  now: () => Date = () => new Date(),
): ReservationSchema {
  return baseSchema.superRefine((values, ctx) => {
    for (const issue of checkReservationRules(values, area, now())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
    }
  });
}

/** Motivo opcional de uma decisao (aprovar, recusar, cancelar). */
export const decisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(DECISION_REASON_MAX, `Use no máximo ${DECISION_REASON_MAX} caracteres.`),
});

export type DecisionFormValues = z.infer<typeof decisionSchema>;

/** Corpo aceito por `POST /reservations`. */
export type ReservationPayload = {
  condominiumId: string;
  commonAreaId: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  guestsCount: number;
  notes: string | null;
};

export const RESERVATION_FIELDS: ReadonlySet<string> = new Set(Object.keys(baseSchema.shape));

export function toReservationPayload(
  values: ReservationFormValues,
  condominiumId: string,
): ReservationPayload {
  return {
    condominiumId,
    commonAreaId: values.commonAreaId,
    unitId: values.unitId,
    // O servidor recebe um instante; o formulario fala hora local.
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
    guestsCount: values.guestsCount === '' ? 0 : Number(values.guestsCount),
    notes: values.notes === '' ? null : values.notes,
  };
}

export const RESERVATION_FORM_DEFAULTS: ReservationFormValues = {
  commonAreaId: '',
  unitId: '',
  startsAt: '',
  endsAt: '',
  guestsCount: '0',
  notes: '',
};
