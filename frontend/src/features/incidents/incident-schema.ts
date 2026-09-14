/**
 * Espelho cliente de `backend/src/modules/incidents/incident.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toIncidentPayload`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell. O
 * protocolo tambem nao: quem o gera e o servidor, em `nextProtocol`, e
 * `createIncidentSchema` sequer o aceita. O formulario o mostra na edicao, mas
 * nunca o envia.
 */

import { z } from 'zod';
import { INCIDENT_CATEGORIES, INCIDENT_PRIORITIES, INCIDENT_STATUSES } from '@/types/incident';
import type { Incident } from '@/types/incident';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no maximo ${max} caracteres.`);
}

/** Teto da descricao e da tratativa no servidor. */
export const DESCRIPTION_MAX_LENGTH = 5000;

const incidentFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe o titulo da ocorrencia.')
    .max(180, 'Use no maximo 180 caracteres.'),
  description: z
    .string()
    .trim()
    .min(5, 'Descreva a ocorrencia.')
    .max(DESCRIPTION_MAX_LENGTH, `Use no maximo ${DESCRIPTION_MAX_LENGTH} caracteres.`),
  location: optionalText(180),
  category: z.enum(INCIDENT_CATEGORIES),
  priority: z.enum(INCIDENT_PRIORITIES),
});

export const incidentSchema = incidentFields;

export type IncidentFormValues = z.infer<typeof incidentSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const INCIDENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(incidentFields.shape));

/** Os padroes sao os do servidor: categoria "outros" e prioridade media. */
export function incidentFormDefaults(): IncidentFormValues {
  return {
    title: '',
    description: '',
    location: '',
    category: 'OTHER',
    priority: 'MEDIUM',
  };
}

/**
 * Corpo aceito por `POST /incidents`; a atualizacao e o parcial dele.
 *
 * `status` e `assignedToId` ficam de fora de proposito: quem os move sao as
 * rotas `/status` e `/assign`, que verificam a transicao e a permissao. Manda-los
 * daqui criaria um segundo caminho para as mesmas mudancas, sem aquelas
 * verificacoes — e `assign` exige `manage`, que o PATCH nao exige.
 */
export type IncidentPayload = {
  condominiumId: string;
  title: string;
  description: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor. */
  location: string | null;
  category: IncidentFormValues['category'];
  priority: IncidentFormValues['priority'];
};

function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toIncidentPayload(
  values: IncidentFormValues,
  condominiumId: string,
): IncidentPayload {
  return {
    condominiumId,
    title: values.title,
    description: values.description,
    location: orNull(values.location),
    category: values.category,
    priority: values.priority,
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toIncidentFormValues(incident: Incident): IncidentFormValues {
  return {
    title: incident.title,
    description: incident.description,
    location: incident.location ?? '',
    category: incident.category,
    priority: incident.priority,
  };
}

// ---------------------------------------------------------------------------
// Mudanca de status
// ---------------------------------------------------------------------------

/**
 * Espelho de `changeStatusSchema`.
 *
 * A tratativa e opcional no schema, mas o servico a exige para resolver ou
 * recusar — e a recusa vem como `BusinessRuleError`, isto e, 409 sem caminho de
 * campo. E por isso que a acao de linha abre um dialogo em vez de postar direto:
 * ha o que perguntar.
 *
 * Quais status podem virar quais continua sendo do servidor: `STATUS_FLOW` nao e
 * duplicado aqui.
 */
export const changeStatusSchema = z.object({
  status: z.enum(INCIDENT_STATUSES),
  resolution: optionalText(DESCRIPTION_MAX_LENGTH),
});

export type ChangeStatusFormValues = z.infer<typeof changeStatusSchema>;

export const CHANGE_STATUS_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(changeStatusSchema.shape),
);

/** Corpo aceito por `POST /incidents/:id/status`. */
export type ChangeStatusPayload = {
  status: ChangeStatusFormValues['status'];
  resolution: string | null;
};

export function toChangeStatusPayload(values: ChangeStatusFormValues): ChangeStatusPayload {
  return { status: values.status, resolution: orNull(values.resolution) };
}

// ---------------------------------------------------------------------------
// Atribuicao
// ---------------------------------------------------------------------------

/** Espelho de `assignIncidentSchema`: o responsavel e obrigatorio. */
export const assignSchema = z.object({
  assignedToId: z.string().min(1, 'Selecione o responsavel pela ocorrencia.'),
});

export type AssignFormValues = z.infer<typeof assignSchema>;

export const ASSIGN_FIELDS: ReadonlySet<string> = new Set(Object.keys(assignSchema.shape));

/** Corpo aceito por `POST /incidents/:id/assign`. */
export type AssignPayload = {
  assignedToId: string;
};

export function toAssignPayload(values: AssignFormValues): AssignPayload {
  return { assignedToId: values.assignedToId };
}
