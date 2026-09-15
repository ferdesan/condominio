/**
 * Espelho cliente de `backend/src/modules/assemblies/schemas/assembly.schema.ts`.
 *
 * Mesma convencao dos demais formularios: tudo entra e sai como string, entao
 * `z.infer` basta e o `useForm` precisa de um generico so. A conversao para o
 * corpo da requisicao acontece nas funcoes `to...Payload`.
 *
 * Datas com hora viajam como ISO e sao editadas em horario local — a mesma
 * traducao que `correspondence-schema.ts` estabeleceu, e pelo mesmo motivo: o
 * input nativo fala `AAAA-MM-DDTHH:mm` local, e o servidor fala ISO.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. `status`
 * tambem nao: a assembleia nasce agendada e quem a move sao as acoes de linha,
 * que tem rota propria e verificacoes que o PATCH nao faz.
 */

import { z } from 'zod';
import {
  ASSEMBLY_MODES,
  ASSEMBLY_TYPES,
  POLL_VOTER_TYPES,
  type Assembly,
  type Poll,
} from '@/types/assembly';

// ---------------------------------------------------------------------------
// Conversao de data e hora
// ---------------------------------------------------------------------------

/** Agora, no formato do input nativo. */
function localNow(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Horario local do formulario -> ISO para o servidor. */
function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** ISO do servidor -> horario local do formulario. Ausente vira vazio. */
export function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Assembleia
// ---------------------------------------------------------------------------

const assemblyFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe o titulo da assembleia.')
    .max(180, 'Use no maximo 180 caracteres.'),
  description: z.string().trim().max(5000, 'Use no maximo 5000 caracteres.'),
  type: z.enum(ASSEMBLY_TYPES),
  mode: z.enum(ASSEMBLY_MODES),
  scheduledAt: z.string().min(1, 'Informe a data e a hora da convocacao.'),
  /** Vazio significa sem segunda convocacao; o servidor aceita nulo. */
  secondCallAt: z.string(),
  location: z.string().trim().max(180, 'Use no maximo 180 caracteres.'),
  onlineUrl: z.string().trim().max(255, 'Use no maximo 255 caracteres.'),
  agendaUrl: z.string().trim().max(255, 'Use no maximo 255 caracteres.'),
  quorumPercent: z
    .string()
    .refine((value) => value === '' || Number.isFinite(Number(value)), 'Informe um numero.')
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      'O quorum vai de 0 a 100.',
    ),
});

/**
 * As duas regras do servidor duplicadas aqui, e so elas.
 *
 * `assertSchedule` recusa a segunda convocacao anterior a primeira como
 * `BusinessRuleError` — 409 sem caminho de campo, e uma mensagem geral nao diz
 * qual controle consertar. A exigencia de URL valida vem do proprio zod do
 * servidor, mas so depois do envio; dita no campo, tem conserto obvio.
 */
export const assemblySchema = assemblyFields
  .refine((values) => !values.onlineUrl || /^https?:\/\//i.test(values.onlineUrl), {
    path: ['onlineUrl'],
    message: 'Informe um endereco comecando com http:// ou https://.',
  })
  .refine((values) => !values.agendaUrl || /^https?:\/\//i.test(values.agendaUrl), {
    path: ['agendaUrl'],
    message: 'Informe um endereco comecando com http:// ou https://.',
  })
  .refine(
    (values) =>
      !values.secondCallAt ||
      !values.scheduledAt ||
      new Date(values.secondCallAt) >= new Date(values.scheduledAt),
    {
      path: ['secondCallAt'],
      message: 'A segunda convocacao deve ser posterior ao horario da primeira.',
    },
  );

export type AssemblyFormValues = z.infer<typeof assemblyFields>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const ASSEMBLY_FIELDS: ReadonlySet<string> = new Set(Object.keys(assemblyFields.shape));

/** Os padroes sao os do servidor: ordinaria, hibrida, quorum de 50%. */
export function assemblyFormDefaults(): AssemblyFormValues {
  return {
    title: '',
    description: '',
    type: 'ORDINARY',
    mode: 'HYBRID',
    scheduledAt: localNow(),
    secondCallAt: '',
    location: '',
    onlineUrl: '',
    agendaUrl: '',
    quorumPercent: '50',
  };
}

export type AssemblyPayload = {
  condominiumId: string;
  title: string;
  description: string | null;
  type: AssemblyFormValues['type'];
  mode: AssemblyFormValues['mode'];
  scheduledAt: string;
  secondCallAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  agendaUrl: string | null;
  quorumPercent: number;
};

export function toAssemblyPayload(
  values: AssemblyFormValues,
  condominiumId: string,
): AssemblyPayload {
  return {
    condominiumId,
    title: values.title,
    description: values.description || null,
    type: values.type,
    mode: values.mode,
    scheduledAt: toIso(values.scheduledAt),
    secondCallAt: values.secondCallAt ? toIso(values.secondCallAt) : null,
    location: values.location || null,
    onlineUrl: values.onlineUrl || null,
    agendaUrl: values.agendaUrl || null,
    quorumPercent: values.quorumPercent === '' ? 0 : Number(values.quorumPercent),
  };
}

export function toAssemblyFormValues(assembly: Assembly): AssemblyFormValues {
  return {
    title: assembly.title,
    description: assembly.description ?? '',
    type: assembly.type,
    mode: assembly.mode,
    scheduledAt: toLocalDateTime(assembly.scheduledAt),
    secondCallAt: toLocalDateTime(assembly.secondCallAt),
    location: assembly.location ?? '',
    onlineUrl: assembly.onlineUrl ?? '',
    agendaUrl: assembly.agendaUrl ?? '',
    quorumPercent: String(assembly.quorumPercent),
  };
}

// ---------------------------------------------------------------------------
// Encerramento
// ---------------------------------------------------------------------------

const finishFields = z.object({
  attendeesCount: z
    .string()
    .refine((value) => value !== '', 'Informe quantas unidades estiveram presentes.')
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0, 'Informe um numero.'),
  minutesUrl: z.string().trim().max(255, 'Use no maximo 255 caracteres.'),
});

export const finishAssemblySchema = finishFields.refine(
  (values) => !values.minutesUrl || /^https?:\/\//i.test(values.minutesUrl),
  { path: ['minutesUrl'], message: 'Informe um endereco comecando com http:// ou https://.' },
);

export type FinishAssemblyFormValues = z.infer<typeof finishFields>;

export const FINISH_FIELDS: ReadonlySet<string> = new Set(Object.keys(finishFields.shape));

export function finishFormDefaults(assembly: Assembly): FinishAssemblyFormValues {
  return {
    attendeesCount: String(assembly.attendeesCount || 0),
    minutesUrl: assembly.minutesUrl ?? '',
  };
}

export type FinishAssemblyPayload = {
  attendeesCount: number;
  minutesUrl: string | null;
};

export function toFinishPayload(values: FinishAssemblyFormValues): FinishAssemblyPayload {
  return {
    attendeesCount: Number(values.attendeesCount),
    minutesUrl: values.minutesUrl || null,
  };
}

// ---------------------------------------------------------------------------
// Votacao
// ---------------------------------------------------------------------------

const pollFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe a pergunta da votacao.')
    .max(180, 'Use no maximo 180 caracteres.'),
  description: z.string().trim().max(5000, 'Use no maximo 5000 caracteres.'),
  voterType: z.enum(POLL_VOTER_TYPES),
  weightedByFraction: z.boolean(),
  isSecret: z.boolean(),
  startsAt: z.string().min(1, 'Informe quando a votacao abre.'),
  endsAt: z.string().min(1, 'Informe quando a votacao encerra.'),
  quorumPercent: z
    .string()
    .refine((value) => value === '' || Number.isFinite(Number(value)), 'Informe um numero.')
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      'O quorum vai de 0 a 100.',
    ),
  /**
   * Duas no minimo, como o servidor exige. Sao editadas como uma lista de
   * campos, e nao como texto livre: cada opcao vira um registro proprio com
   * contador, e um separador em texto seria ambiguo quando a opcao tem virgula.
   */
  options: z
    .array(
      z.object({
        label: z
          .string()
          .trim()
          .min(1, 'Informe o texto da opcao.')
          .max(180, 'Use no maximo 180 caracteres.'),
      }),
    )
    .min(2, 'Informe ao menos duas opcoes de voto.')
    .max(20, 'Use no maximo 20 opcoes.'),
});

export const pollSchema = pollFields.refine(
  (values) =>
    !values.startsAt || !values.endsAt || new Date(values.endsAt) > new Date(values.startsAt),
  { path: ['endsAt'], message: 'O encerramento deve ser posterior a abertura.' },
);

export type PollFormValues = z.infer<typeof pollFields>;

export const POLL_FIELDS: ReadonlySet<string> = new Set(Object.keys(pollFields.shape));

/**
 * Os padroes sao os do servidor, com uma excecao deliberada: duas opcoes ja
 * aparecem vazias. O minimo e dois, entao comecar com zero obrigaria a descobrir
 * o botao de adicionar antes de entender o formulario.
 */
export function pollFormDefaults(): PollFormValues {
  return {
    title: '',
    description: '',
    voterType: 'OWNERS',
    weightedByFraction: false,
    isSecret: false,
    startsAt: localNow(),
    endsAt: '',
    quorumPercent: '0',
    options: [{ label: '' }, { label: '' }],
  };
}

export type PollPayload = {
  condominiumId: string;
  assemblyId: string | null;
  title: string;
  description: string | null;
  voterType: PollFormValues['voterType'];
  weightedByFraction: boolean;
  isSecret: boolean;
  startsAt: string;
  endsAt: string;
  quorumPercent: number;
  options: Array<{ label: string }>;
};

export function toPollPayload(
  values: PollFormValues,
  condominiumId: string,
  assemblyId: string | null,
): PollPayload {
  return {
    condominiumId,
    assemblyId,
    title: values.title,
    description: values.description || null,
    voterType: values.voterType,
    weightedByFraction: values.weightedByFraction,
    isSecret: values.isSecret,
    startsAt: toIso(values.startsAt),
    endsAt: toIso(values.endsAt),
    quorumPercent: values.quorumPercent === '' ? 0 : Number(values.quorumPercent),
    options: values.options.map((option) => ({ label: option.label })),
  };
}

/**
 * Registro do servidor -> valores do formulario.
 *
 * `options` **nao** volta: `updatePollSchema` as omite de proposito no servidor,
 * porque alterar as alternativas de uma votacao que ja recebeu votos invalidaria
 * a apuracao. A edicao so alcanca o enunciado e as regras.
 */
export function toPollFormValues(poll: Poll): PollFormValues {
  return {
    title: poll.title,
    description: poll.description ?? '',
    voterType: poll.voterType,
    weightedByFraction: poll.weightedByFraction,
    isSecret: poll.isSecret,
    startsAt: toLocalDateTime(poll.startsAt),
    endsAt: toLocalDateTime(poll.endsAt),
    quorumPercent: String(poll.quorumPercent),
    options: (poll.options ?? []).map((option) => ({ label: option.label })),
  };
}
