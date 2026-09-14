import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommonArea } from '@/types/api';
import { monthRange } from '../calendar-grid';
import { monthFilters, useReservationCount, useReservationCounts } from '../reservation-hooks';

/** Areas listadas individualmente antes de o resto virar uma linha agregada. */
const MAX_AREAS_SHOWN = 6;

export interface ReservationIndicatorsProps {
  condominiumId: string | null;
  month: Date;
  areas: CommonArea[];
}

/**
 * Indicadores do mes exibido no calendario: total, detalhamento por area e
 * cancelamentos.
 *
 * Os numeros descrevem o mes inteiro, e nao o recorte da lista — o rotulo diz
 * isso explicitamente, para que nao sejam lidos como algo que nao sao. Era uma
 * questao em aberto do PRD e esta e a leitura que ele registra como suposicao
 * de trabalho.
 *
 * As consultas sao separadas das da listagem para que uma falha aqui nao leve a
 * tela junto: a lista continua utilizavel com os indicadores em erro.
 */
export function ReservationIndicators({ condominiumId, month, areas }: ReservationIndicatorsProps) {
  const { from, to } = monthRange(month);
  const range = monthFilters(from, to);
  const enabled = Boolean(condominiumId);
  const base = { condominiumId: condominiumId ?? '', ...range };

  const total = useReservationCount(base, { enabled });
  const canceled = useReservationCount({ ...base, status: 'CANCELED' }, { enabled });
  const perArea = useReservationCounts(
    areas.map((area) => ({ ...base, commonAreaId: area.id })),
    { enabled },
  );

  const monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR });
  const failed = total.isError || canceled.isError || perArea.some((query) => query.isError);

  const breakdown = areas
    .map((area, index) => ({ area, count: perArea[index]?.data ?? 0 }))
    .sort((left, right) => right.count - left.count);
  const shown = breakdown.slice(0, MAX_AREAS_SHOWN);
  const rest = breakdown.slice(MAX_AREAS_SHOWN);
  const restTotal = rest.reduce((sum, item) => sum + item.count, 0);

  return (
    // Regiao nomeada: os indicadores sao um bloco proprio, navegavel sem
    // atravessar a lista inteira.
    <Card role="region" className="p-4" aria-labelledby="reservation-indicators-title">
      <div className="mb-3">
        <h2 id="reservation-indicators-title" className="text-sm font-semibold capitalize">
          Indicadores de {monthLabel}
        </h2>
        <p className="text-xs text-muted-foreground">
          Numeros do mes inteiro, independentes dos filtros aplicados na lista.
        </p>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Nao foi possivel carregar os indicadores do mes. A lista de reservas continua
          disponivel.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Reservas no mes" value={total.data} loading={total.isPending} />
          <Metric label="Cancelamentos" value={canceled.data} loading={canceled.isPending} />

          <div className="sm:col-span-1">
            <p className="text-xs text-muted-foreground">Por area comum</p>
            {areas.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Nenhuma area comum cadastrada neste condominio.
              </p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm">
                {shown.map(({ area, count }) => (
                  <li key={area.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{area.name}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
                {rest.length > 0 ? (
                  <li className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span className="truncate">Outras {rest.length} areas</span>
                    <span className="font-medium tabular-nums">{restTotal}</span>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {/* O esqueleto ocupa o mesmo espaco do numero: a area nao pula quando carrega. */}
      {loading ? (
        <Skeleton className="mt-1 h-8 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
      )}
    </div>
  );
}
