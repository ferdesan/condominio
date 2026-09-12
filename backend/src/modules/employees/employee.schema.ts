import { z } from 'zod';
import { cpfSchema, emailSchema, phoneSchema, uuidSchema } from '@/shared/dto/common.schema';
import { EMPLOYEE_CONTRACT_TYPES, EMPLOYEE_STATUSES } from './employee.entity';

export const createEmployeeSchema = z.object({
  condominiumId: uuidSchema,
  userId: uuidSchema.optional().nullable(),
  name: z.string().min(3, 'Informe o nome do funcionario.').max(150),
  document: cpfSchema.optional().nullable(),
  position: z.string().min(2, 'Informe o cargo.').max(100),
  department: z.string().max(100).optional().nullable(),
  contractType: z.enum(EMPLOYEE_CONTRACT_TYPES).default('CLT'),
  status: z.enum(EMPLOYEE_STATUSES).default('ACTIVE'),
  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  admissionDate: z.string().date().optional().nullable(),
  terminationDate: z.string().date().optional().nullable(),
  workSchedule: z.string().max(120).optional().nullable(),
  salary: z.coerce.number().min(0).max(9999999).optional().nullable(),
  photoUrl: z.string().url().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeDTO = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;
