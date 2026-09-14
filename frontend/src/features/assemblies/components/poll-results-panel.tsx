import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatPercent } from '@/lib/format';
import { usePollResults } from '../assembly-hooks';
import { weightingLabel } from '../assembly-labels';

export interface PollResultsPanelProps {
  pollId: string;
}

/**
 * A apuracao de uma deliberacao, de `GET /polls/:id/results`.
 *
 * Os percentuais vem do servidor, e nao de uma conta sobre os contadores: o
 * denominador muda conforme a votacao seja ponderada — peso — ou nao —
 * contagem —, e refazer essa escolha aqui criaria uma segunda versao dela.
 *
 * A barra e decorativa; quem carrega o numero e o texto ao lado. Uma barra sem
 * valor escrito nao e legivel por quem nao enxerga a proporcao.
 */
export function PollResultsPanel({ pollId }: PollResultsPanelProps) {
  const results = usePollResults(pollId);

  if (results.isPending) return <Skeleton className="h-24 w-full" />;

  if (results.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Nao foi possivel carregar a apuracao desta deliberacao.
      </p>
    );
  }

  const data = results.data;

  return (
    <div className="space-y-3 rounded-md bg-muted/40 p-3">
      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Votos registrados</dt>
          <dd className="font-medium tabular-nums">
            {formatNumber(data.totalVotes)} de {formatNumber(data.eligibleUnits)} unidades
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Participacao</dt>
          <dd className="font-medium tabular-nums">
            {formatPercent(data.participationPercent)}
            {/* O texto diz se o quorum foi atingido: a cor sozinha nao diria. */}
            <span className="ml-1 font-normal text-muted-foreground">
              ({data.quorumReached ? 'quorum atingido' : 'quorum nao atingido'}, exigido{' '}
              {formatPercent(data.quorumPercent)})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contagem</dt>
          <dd className="font-medium">{weightingLabel(data.weighted)}</dd>
        </div>
      </dl>

      <ul className="space-y-2">
        {data.options.map((option) => (
          <li key={option.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{option.label}</span>
              <span className="tabular-nums">
                {formatPercent(option.percent)} · {formatNumber(option.votesCount)} voto
                {option.votesCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, option.percent))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
