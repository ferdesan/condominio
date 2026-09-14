import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INCIDENT_STATUSES } from '@/types/incident';
import { totalOf, useIncidentSummary } from '../incident-hooks';
import { STATUS_LABELS } from '../incident-labels';

export interface IncidentIndicatorsProps {
  condominiumId: string | null;
}

/**
 * Indicadores da fila de ocorrencias, por status.
 *
 * Os numeros vem de `GET /incidents/summary`, que agrupa no banco, e nao de uma
 * contagem sobre as linhas carregadas: a lista mostra uma pagina de vinte e um
 * recorte de filtros, entao conta-la responderia outra pergunta. O rotulo diz
 * que os numeros descrevem o condominio inteiro, para que nao sejam lidos como
 * algo que nao sao.
 *
 * A consulta e separada da listagem para que uma falha aqui nao leve a tela
 * junto: a lista continua utilizavel com os indicadores em erro.
 */
export function IncidentIndicators({ condominiumId }: IncidentIndicatorsProps) {
  const summary = useIncidentSummary(condominiumId);

  // O servidor devolve so os status que tem ocorrencias; os ausentes sao zero, e
  // e a tela que os completa — uma fila vazia num status e informacao.
  const breakdown = INCIDENT_STATUSES.map((status) => ({
    status,
    total: totalOf(summary.data, status),
  }));
  const total = breakdown.reduce((sum, entry) => sum + entry.total, 0);

  return (
    // Regiao nomeada: os indicadores sao um bloco proprio, navegavel sem
    // atravessar a lista inteira.
    <Card role="region" className="p-4" aria-labelledby="incident-indicators-title">
      <div className="mb-3">
        <h2 id="incident-indicators-title" className="text-sm font-semibold">
          Indicadores de ocorrencias
        </h2>
        <p className="text-xs text-muted-foreground">
          Numeros do condominio inteiro, independentes dos filtros aplicados na lista.
        </p>
      </div>

      {summary.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Nao foi possivel carregar os indicadores. A lista de ocorrencias continua disponivel.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Total de ocorrencias</p>
            {/* O esqueleto ocupa o mesmo espaco do numero: a area nao pula quando carrega. */}
            {summary.isPending ? (
              <Skeleton className="mt-1 h-8 w-16" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
            )}
          </div>

          <ul className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {breakdown.map((entry) => (
              <li key={entry.status} className="flex items-baseline justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {STATUS_LABELS[entry.status]}
                </span>
                <span className="font-medium tabular-nums">
                  {summary.isPending ? '—' : entry.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
