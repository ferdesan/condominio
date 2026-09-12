import { z } from 'zod';
import { uuidSchema } from '@/shared/dto/common.schema';
import { ASSEMBLY_MODES, ASSEMBLY_STATUSES, ASSEMBLY_TYPES } from '../entities/assembly.entity';
import { POLL_STATUSES, POLL_VOTER_TYPES } from '../entities/poll.entity';

export const createAssemblySchema = z.object({
  condominiumId: uuidSchema,
  title: z.string().min(3, 'Informe o titulo da assembleia.').max(180),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(ASSEMBLY_TYPES).default('ORDINARY'),
  status: z.enum(ASSEMBLY_STATUSES).default('SCHEDULED'),
  mode: z.enum(ASSEMBLY_MODES).default('HYBRID'),
  scheduledAt: z.coerce.date(),
  secondCallAt: z.coerce.date().optional().nullable(),
  location: z.string().max(180).optional().nullable(),
  onlineUrl: z.string().url().max(255).optional().nullable(),
  quorumPercent: z.coerce.number().int().min(0).max(100).default(50),
  agendaUrl: z.string().url().max(255).optional().nullable(),
});

export const updateAssemblySchema = createAssemblySchema.partial().extend({
  minutesUrl: z.string().url().max(255).optional().nullable(),
  attendeesCount: z.coerce.number().int().min(0).optional(),
});

export const finishAssemblySchema = z.object({
  minutesUrl: z.string().url().max(255).optional().nullable(),
  attendeesCount: z.coerce.number().int().min(0).default(0),
});

export const createPollSchema = z
  .object({
    condominiumId: uuidSchema,
    assemblyId: uuidSchema.optional().nullable(),
    title: z.string().min(3, 'Informe a pergunta da votacao.').max(180),
    description: z.string().max(5000).optional().nullable(),
    status: z.enum(POLL_STATUSES).default('DRAFT'),
    voterType: z.enum(POLL_VOTER_TYPES).default('OWNERS'),
    weightedByFraction: z.boolean().default(false),
    isSecret: z.boolean().default(false),
    allowMultiple: z.boolean().default(false),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    quorumPercent: z.coerce.number().int().min(0).max(100).default(0),
    options: z
      .array(
        z.object({
          label: z.string().min(1, 'Informe o texto da opcao.').max(180),
          description: z.string().max(255).optional().nullable(),
        }),
      )
      .min(2, 'Informe ao menos duas opcoes de voto.')
      .max(20),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'O encerramento deve ser posterior a abertura.',
    path: ['endsAt'],
  });

export const updatePollSchema = createPollSchema.innerType().partial().omit({ options: true });

export const castVoteSchema = z.object({
  optionId: uuidSchema,
});

export type CreateAssemblyDTO = z.infer<typeof createAssemblySchema>;
export type UpdateAssemblyDTO = z.infer<typeof updateAssemblySchema>;
export type FinishAssemblyDTO = z.infer<typeof finishAssemblySchema>;
export type CreatePollDTO = z.infer<typeof createPollSchema>;
export type UpdatePollDTO = z.infer<typeof updatePollSchema>;
export type CastVoteDTO = z.infer<typeof castVoteSchema>;
