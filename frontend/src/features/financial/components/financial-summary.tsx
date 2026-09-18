import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { useChargeSummary, useDelinquency } from '../financial-hooks';

export interface FinancialSummaryProps {
  condominiumId: string | null;
  /** Competencia AAAA-MM; ausente agrega todas. */
  referenceMonth?: string;
}

/**
 * O resumo do condominio e as unidades mais inadimplentes.
 *
 * Os numeros vem de `/financial/charges/summary` e `/financial/charges/delinquency`,
 * que agregam no banco — e nao de uma soma sobre as vinte linhas carregadas, que
 * responderia outra pergunta. O rotulo diz que o recorte e do condominio
 * inteiro, para que nao sejam lidos como algo que nao sao.
 *
 * As duas consultas sao separadas da listagem para que uma falha aqui nao leve a
 * tela junto: as secoes continuam utilizaveis com os indicadores em erro.
 */
export function FinancialSummary({ condominiumId, referenceMonth }: FinancialSummaryProps) {
  const summary = useChargeSummary(condominiumId, referenceMonth);
  const delinquency = useDelinquency(condominiumId);

  const data = summary.data;
  const worst = delinquency.data ?? [];

  return (
    <Card role="region" className="p-4" aria-labelledby="financial-summary-title">
      <div className="mb-3">
        <h2 id="financial-summary-title" className="text-sm font-semibold">
          Posição financeira
        </h2>
        <p className="text-xs text-muted-foreground">
          Números do condomínio inteiro
          {referenceMonth ? ` na competência ${referenceMonth}` : ', somando todas as competências'}
          , independentes dos filtros das listas.
        </p>
      </div>

      {summary.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar a posição financeira. As listas continuam disponíveis.
        </p>
      ) : summary.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Faturado</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(data?.billed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Recebido</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(data?.received)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Em aberto</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(data?.open)}</dd>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.pendingCount)} cobranças a receber
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vencido</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(data?.overdue)}</dd>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.overdueCount)} vencidas · inadimplencia de{' '}
              {formatPercent(data?.delinquencyRate)}
            </p>
          </div>
        </dl>
      )}

      {/*
        A lista de piores pagadores e do servidor, já ordenada e limitada a dez:
        o recorte e dele e não se refaz aqui.
      */}
      {delinquency.isError ? null : delinquency.isPending ? null : worst.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Unidades com maior saldo vencido
          </h3>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {worst.map((row) => (
              <li key={row.unitId} className="flex items-baseline justify-between gap-2">
                <span className="truncate">Unidade {row.unitNumber ?? row.unitId}</span>
                <span className="tabular-nums">
                  {formatCurrency(row.total)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({formatNumber(row.charges)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
