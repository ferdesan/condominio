/**
 * Espelho cliente de `backend/src/modules/vehicles/vehicle.schema.ts`.
 *
 * Mesma convencao dos demais formularios: todo campo entra e sai como string,
 * entao `z.infer` basta e o `useForm` precisa de um generico so. A conversao
 * para o corpo da requisicao acontece em `toVehiclePayload`, que e onde o ano
 * volta a ser numero e os vinculos vazios viram `null`.
 *
 * `condominiumId` nao e campo de formulario — vem do seletor do shell.
 *
 * `unitId` e `residentId` sao opcionais no servidor, e o formulario mantem essa
 * liberdade: um veiculo de visitante recorrente, ou o de um morador que ainda
 * nao foi cadastrado, existe sem dono nenhum.
 */

import { z } from 'zod';
import { VEHICLE_STATUSES, VEHICLE_TYPES, type Vehicle } from '@/types/api';

/**
 * Placa no padrao antigo (`AAA1234`) ou Mercosul (`AAA1A23`).
 *
 * Copiado de `plateSchema` no servidor, que e quem manda: divergir aqui produz
 * uma recusa que a tela nao explicou, ou um envio que ela deixou passar.
 */
export const PLATE_PATTERN = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/;

/** Campo opcional de texto livre: vazio e ausencia, nao erro. */
function optionalText(max: number) {
  return z.string().trim().max(max, `Use no maximo ${max} caracteres.`);
}

const vehicleFields = z.object({
  // Vinculos opcionais: string vazia e a ausencia de vinculo, e nao um id ruim.
  unitId: z.string(),
  residentId: z.string(),
  plate: z
    .string()
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((value) => value !== '', 'Informe a placa do veiculo.')
    .refine(
      (value) => value === '' || PLATE_PATTERN.test(value),
      'Placa invalida. Use o formato ABC1234 ou ABC1D23.',
    ),
  brand: optionalText(60),
  model: optionalText(60),
  color: optionalText(40),
  type: z.enum(VEHICLE_TYPES),
  year: z
    .string()
    .refine(
      (value) => value === '' || /^\d{4}$/.test(value),
      'Informe o ano com quatro digitos.',
    )
    .refine(
      (value) => value === '' || (Number(value) >= 1900 && Number(value) <= 2100),
      'O ano deve estar entre 1900 e 2100.',
    ),
  parkingSpot: optionalText(20),
  stickerNumber: optionalText(30),
  status: z.enum(VEHICLE_STATUSES),
  notes: optionalText(1000),
});

export const vehicleSchema = vehicleFields;

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

/** Nomes que o formulario possui — `applyApiError` usa isto para decidir o destino da mensagem. */
export const VEHICLE_FIELDS: ReadonlySet<string> = new Set(Object.keys(vehicleFields.shape));

export const VEHICLE_FORM_DEFAULTS: VehicleFormValues = {
  unitId: '',
  residentId: '',
  plate: '',
  brand: '',
  model: '',
  color: '',
  // Os padroes do servidor.
  type: 'CAR',
  year: '',
  parkingSpot: '',
  stickerNumber: '',
  status: 'ACTIVE',
  notes: '',
};

/** Corpo aceito por `POST /vehicles`; a atualizacao e o parcial dele. */
export type VehiclePayload = {
  condominiumId: string;
  unitId: string | null;
  residentId: string | null;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: VehicleFormValues['type'];
  year: number | null;
  parkingSpot: string | null;
  stickerNumber: string | null;
  status: VehicleFormValues['status'];
  notes: string | null;
};

/** Vazio vira `null`, e nunca chave ausente: limpar um campo precisa apagar o valor guardado. */
function orNull(value: string): string | null {
  return value === '' ? null : value;
}

export function toVehiclePayload(values: VehicleFormValues, condominiumId: string): VehiclePayload {
  return {
    condominiumId,
    // Desfazer um vinculo e enviar `null`, nao omitir a chave.
    unitId: orNull(values.unitId),
    residentId: orNull(values.residentId),
    plate: values.plate,
    brand: orNull(values.brand),
    model: orNull(values.model),
    color: orNull(values.color),
    type: values.type,
    year: values.year === '' ? null : Number(values.year),
    parkingSpot: orNull(values.parkingSpot),
    stickerNumber: orNull(values.stickerNumber),
    status: values.status,
    notes: orNull(values.notes),
  };
}

/** Registro do servidor -> valores do formulario. Ausente vira string vazia. */
export function toVehicleFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    unitId: vehicle.unitId ?? '',
    residentId: vehicle.residentId ?? '',
    plate: vehicle.plate,
    brand: vehicle.brand ?? '',
    model: vehicle.model ?? '',
    color: vehicle.color ?? '',
    type: vehicle.type,
    year: vehicle.year === null ? '' : String(vehicle.year),
    parkingSpot: vehicle.parkingSpot ?? '',
    stickerNumber: vehicle.stickerNumber ?? '',
    status: vehicle.status,
    notes: vehicle.notes ?? '',
  };
}

/**
 * A placa guardada sem separador, apresentada com o do seu padrao.
 *
 * A antiga ganha o hifen que sempre teve (`ABC-1234`); a Mercosul nao tem
 * separador nenhum e fica como esta. O que nao casar com nenhum dos dois sai
 * intacto, porque inventar pontuacao para um valor inesperado o esconde.
 */
export function formatPlate(plate: string): string {
  if (!PLATE_PATTERN.test(plate)) return plate;
  return /^[A-Z]{3}[0-9]{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

/**
 * Prepara um termo de busca que aparenta ser placa.
 *
 * Placas sao guardadas em caixa alta e sem separador, entao `abc-1234` nao
 * casaria com nada. So o termo que vira uma placa valida depois de normalizado e
 * normalizado — qualquer outro passa intacto, porque a busca cobre tambem marca,
 * modelo e vaga, e uppercase num deles depende da colacao do banco para ainda
 * casar.
 */
export function normalisePlate(term: string): string {
  const trimmed = term.trim();
  const compact = trimmed.toUpperCase().replace(/-/g, '');
  return PLATE_PATTERN.test(compact) ? compact : trimmed;
}
