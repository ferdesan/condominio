import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';

export const createReservationSchema = z
  .object({
    condominiumId: uuidSchema,
    commonAreaId: uuidSchema,
    unitId: uuidSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    guestsCount: z.coerce.number().int().min(0).max(10000).default(0),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'O termino deve ser posterior ao inicio.',
    path: ['endsAt'],
  });

/**
 * Edicao de uma reserva pelo formulario.
 *
 * `status`, `statusReason` e `paidAt` ficam de fora de proposito: o status so
 * muda pelo fluxo de aprovacao (`/approve`, `/reject`, `/cancel`), que exige a
 * permissao certa para cada transicao. Aceita-los aqui deixaria quem tem apenas
 * `reservation:update` confirmar uma reserva sem `reservation:manage`. Como o
 * middleware de validacao substitui o corpo pelo resultado do parse, chaves fora
 * do schema sao descartadas antes de chegar ao servico.
 *
 * O condominio tambem nao e editavel: area e unidade pertencem a ele.
 */
export const updateReservationSchema = createReservationSchema
  .innerType()
  .omit({ condominiumId: true })
  .partial()
  .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
    message: 'O termino deve ser posterior ao inicio.',
    path: ['endsAt'],
  });

export const reviewReservationSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
});

export const availabilityQuerySchema = z.object({
  condominiumId: uuidSchema,
  commonAreaId: uuidSchema.optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type CreateReservationDTO = z.infer<typeof createReservationSchema>;
export type UpdateReservationDTO = z.infer<typeof updateReservationSchema>;

/** Transicao de status: so o fluxo de aprovacao do servico a produz. */
export type ReservationStatusChange = {
  status: 'CONFIRMED' | 'REJECTED' | 'CANCELED';
  statusReason: string | null;
};

/** O que `ReservationService.update` aceita: edicao do formulario ou transicao interna. */
export type ReservationUpdateInput = UpdateReservationDTO | ReservationStatusChange;
export type ReviewReservationDTO = z.infer<typeof reviewReservationSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
