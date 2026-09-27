import { condominiumRepository } from '@/modules/condominiums/condominium.repository';
import { BusinessRuleError, NotFoundError } from '@/shared/errors';
import type { TenantScope } from '@/shared/repositories/types';
import { dayjs, referenceMonthOf } from '@/shared/utils/date.util';
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

/**
 * A nova data de uma correcao precisa existir no caixa: nao pode estar no
 * futuro nem antes do corte do saldo inicial do condominio. Antes do corte o
 * movimento ja esta dentro do saldo de abertura informado no cadastro, e uma
 * baixa movida para la sairia de todo balancete sem aviso.
 */
export async function assertCorrectableCashDate(
  scope: TenantScope,
  condominiumId: string,
  paidAt: Date,
): Promise<void> {
  if (dayjs(paidAt).isAfter(dayjs())) {
    throw new BusinessRuleError('A nova data nao pode estar no futuro.');
  }

  const condominium = await condominiumRepository.findById(scope, condominiumId);
  if (!condominium) throw new NotFoundError('Condominio');

  const cutoff = condominium.openingBalanceDate;
  if (cutoff && dayjs(paidAt).isBefore(dayjs(cutoff).startOf('day'))) {
    throw new BusinessRuleError(
      `A nova data nao pode ser anterior ao saldo inicial do condominio (${dayjs(cutoff).format('DD/MM/YYYY')}).`,
    );
  }
}

/**
 * Recusa mover uma data de caixa quando qualquer competencia entre a data
 * antiga e a nova, inclusive as duas, esta fechada.
 *
 * Conferir so as pontas nao basta. O saldo inicial de um mes herda o saldo
 * final do anterior quando este esta fechado (`resolveOpening`), e a reabertura
 * nao exige que os meses seguintes estejam abertos. Com jan aberto, fev fechado
 * e mar aberto, mover um recebimento de jan para mar tira o valor de um caixa
 * acumulado que fev ja congelou, e mar, que herda de fev, passa a conta-lo de
 * novo: o dinheiro aparece duas vezes sem erro nenhum.
 */
export async function assertRangeOpen(
  scope: TenantScope,
  condominiumId: string,
  from: Date | string,
  to: Date | string,
): Promise<void> {
  const [first, last] = [referenceMonthOf(from), referenceMonthOf(to)].sort();
  const closed = await financialClosingRepository.findClosedBetween(
    scope,
    condominiumId,
    first,
    last,
  );

  if (closed.length) {
    const months = closed.join(', ');
    throw new BusinessRuleError(
      closed.length === 1
        ? `A competencia ${months} esta fechada. Reabra o mes para corrigir a data.`
        : `As competencias ${months} estao fechadas. Reabra os meses para corrigir a data.`,
    );
  }
}
