/**
 * Espelho cliente de `backend/src/modules/maintenances/maintenance.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toMaintenancePayload`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 */

import { z } from 'zod';
import {
  MAINTENANCE_RECURRENCES,
  MAINTENANCE_TYPES,
  type Maintenance,
} from '@/types/maintenance';

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no maximo ${max} caracteres.`);
}

/** Teto da descricao no servidor — bem acima dos 2000 que o `Textarea` traz. */
export const DESCRIPTION_MAX_LENGTH = 5000;

const maintenanceFields = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe o titulo da manutencao.')
    .max(180, 'Use no maximo 180 caracteres.'),
  description: optionalText(DESCRIPTION_MAX_LENGTH),
  assetName: optionalText(150),
  /** Valor local do `datetime-local` (`yyyy-MM-ddTHH:mm`); o servidor faz o parse. */
  scheduledFor: z.string().min(1, 'Informe quando a manutencao esta agendada.'),
  type: z.enum(MAINTENANCE_TYPES),
  recurrence: z.enum(MAINTENANCE_RECURRENCES),
  /** Vazio significa "sem vinculo": o seletor usa string vazia, o corpo usa `null`. */
  serviceProviderId: z.string(),
  responsibleId: z.string(),
});

export const maintenanceSchema = maintenanceFields;

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const MAINTENANCE_FIELDS: ReadonlySet<string> = new Set(
  Object.keys(maintenanceFields.shape),
);

/** Os padroes sao os do servidor: preventiva e sem repeticao. */
export function maintenanceFormDefaults(): MaintenanceFormValues {
  return {
    title: '',
    description: '',
    assetName: '',
    scheduledFor: '',
    type: 'PREVENTIVE',
    recurrence: 'NONE',
    serviceProviderId: '',
    responsibleId: '',
  };
}

/**
 * Corpo aceito por `POST /maintenances`; a atualizacao e o parcial dele.
 *
 * `status` fica de fora de proposito: quem o move sao as rotas `/start`,
 * `/complete` e `/cancel`, que verificam a transicao. Manda-lo daqui criaria um
 * segundo caminho para as mesmas mudancas, sem aquelas verificacoes — e
 * `prepareUpdate` so barra o retorno a partir de `COMPLETED`, de modo que o
 * PATCH aceitaria pular direto para concluida sem registrar `completedAt` nem
 * abrir a proxima ordem recorrente.
 *
 * `startedAt`, `completedAt`, `finalCost` e `nextExecutionAt` tambem ficam de
 * fora: sao do servidor, gravados pelas mesmas rotas.
 */
export type MaintenancePayload = {
  condominiumId: string;
  title: string;
  /** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor. */
  description: string | null;
  assetName: string | null;
  scheduledFor: string;
  type: MaintenanceFormValues['type'];
  recurrence: MaintenanceFormValues['recurrence'];
  serviceProviderId: string | null;
  responsibleId: string | null;
};

function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toMaintenancePayload(
  values: MaintenanceFormValues,
  condominiumId: string,
): MaintenancePayload {
  return {
    condominiumId,
    title: values.title,
    description: orNull(values.description),
    assetName: orNull(values.assetName),
    scheduledFor: values.scheduledFor,
    type: values.type,
    recurrence: values.recurrence,
    serviceProviderId: orNull(values.serviceProviderId),
    responsibleId: orNull(values.responsibleId),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toMaintenanceFormValues(maintenance: Maintenance): MaintenanceFormValues {
  return {
    title: maintenance.title,
    description: maintenance.description ?? '',
    assetName: maintenance.assetName ?? '',
    scheduledFor: maintenance.scheduledFor,
    type: maintenance.type,
    recurrence: maintenance.recurrence,
    serviceProviderId: maintenance.serviceProviderId ?? '',
    responsibleId: maintenance.responsibleId ?? '',
  };
}
