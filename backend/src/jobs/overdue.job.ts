import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/logger';
import { authRepository } from '@/modules/auth/auth.repository';
import { chargeRepository } from '@/modules/financial/repositories/charge.repository';
import { expenseRepository } from '@/modules/financial/repositories/expense.repository';
import { maintenanceRepository } from '@/modules/maintenances/maintenance.repository';
import { Tenant } from '@/modules/tenants/tenant.entity';
import { dayjs } from '@/shared/utils/date.util';

export type OverdueJobResult = {
  tenants: number;
  charges: number;
  expenses: number;
  maintenances: number;
  purgedTokens: number;
};

/**
 * Rotina diaria de consistencia:
 * - cobrancas e despesas vencidas passam para OVERDUE;
 * - ordens de manutencao nao executadas ficam em atraso;
 * - refresh tokens expirados sao removidos da base.
 *
 * E idempotente: rodar duas vezes no mesmo dia nao altera o resultado.
 */
export async function runOverdueJob(): Promise<OverdueJobResult> {
  const result: OverdueJobResult = {
    tenants: 0,
    charges: 0,
    expenses: 0,
    maintenances: 0,
    purgedTokens: 0,
  };

  if (!AppDataSource.isInitialized) return result;

  const today = dayjs().format('YYYY-MM-DD');
  const now = new Date();

  const tenants = await AppDataSource.getRepository(Tenant).find({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  for (const tenant of tenants) {
    try {
      result.charges += await chargeRepository.markOverdue(tenant.id, today);
      result.expenses += await expenseRepository.markOverdue(tenant.id, today);
      result.maintenances += await maintenanceRepository.markOverdue(tenant.id, now);
      result.tenants += 1;
    } catch (error) {
      logger.error(`Overdue job failed for tenant ${tenant.id}: ${(error as Error).message}`);
    }
  }

  result.purgedTokens = await authRepository.purgeExpiredRefreshTokens(now);

  logger.info('Overdue job finished', { ...result });
  return result;
}
