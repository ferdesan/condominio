import { BusinessRuleError } from '@/shared/errors';
import type { TenantScope } from '@/shared/repositories/types';
import { referenceMonthOf } from '@/shared/utils/date.util';
import { financialClosingRepository } from './repositories/financial-closing.repository';

/**
 * Recusa escrita que moveria o caixa de um mes ja fechado (ADR-003).
 *
 * E uma funcao sobre o repositorio, e nao um servico: `ExpenseService` e
 * `ChargeService` a chamam, e um servico chamando outro servico criaria um ciclo
 * de importacao. E o mesmo desenho de `shared/services/reference-guard.ts`.
 *
 * **O que esta guarda NAO cobre, de proposito:** cobranca. Nenhum campo de
 * cobranca alimenta o balancete de caixa (ADR-001), entao recusar um lancamento
 * de cobranca num mes fechado travaria trabalho sem proteger numero nenhum. A
 * inadimplencia, unico numero do documento derivado de cobranca, e congelada por
 * ser gravada no fechamento, e nao por bloquear escrita.
 *
 * Recebe o instante, e nao a competencia: nenhum ponto de chamada formata data.
 */
export async function assertMonthOpen(
  scope: TenantScope,
  condominiumId: string,
  when: Date | string | null | undefined,
): Promise<void> {
  if (!when) return;

  const referenceMonth = referenceMonthOf(when);
  const closing = await financialClosingRepository.findByMonth(
    scope,
    condominiumId,
    referenceMonth,
  );

  if (closing?.status === 'CLOSED') {
    throw new BusinessRuleError(
      `A competencia ${referenceMonth} esta fechada. Reabra o mes para lancar.`,
    );
  }
}
