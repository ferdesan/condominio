import { DoorOpen, Home, KeyRound, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import { unitHooks } from '../unit-hooks';

export interface OccupancyIndicatorsProps {
  condominiumId: string;
  /** Muda apenas o rotulo de escopo: os numeros descrevem o condominio inteiro. */
  filtersActive: boolean;
}

/**
 * Total, ocupadas e disponiveis do condominio selecionado.
 *
 * Nao ha endpoint de agregacao para unidades, entao cada numero vem de uma
 * listagem de um registro so, lida em `meta.total`. As tres consultas sao
 * independentes da listagem: uma falha aqui deixa a lista utilizavel e reporta a
 * si mesma.
 *
 * Reforma e bloqueada entram no total sem ser nem ocupadas nem disponiveis, o que
 * faria as tres parecerem nao fechar. O restante e exibido explicitamente para
 * que fechem — e nao custa uma quarta requisicao, porque sai da subtracao.
 */
export function OccupancyIndicators({ condominiumId, filtersActive }: OccupancyIndicatorsProps) {
  const total = unitHooks.useCount({ condominiumId });
  const occupied = unitHooks.useCount({ condominiumId, status: 'OCCUPIED' });
  const available = unitHooks.useCount({ condominiumId, status: 'VACANT' });

  const queries = [total, occupied, available];
  const failed = queries.some((query) => query.isError);
  const loading = queries.some((query) => query.isPending);

  if (failed) {
    return (
      <section aria-label="Indicadores de ocupacao" className="app-surface p-5">
        <p role="alert" className="text-sm text-destructive">
          Nao foi possivel carregar os indicadores de ocupacao.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => queries.forEach((query) => query.refetch())}
        >
          Tentar novamente
        </Button>
      </section>
    );
  }

  const others =
    total.data !== undefined && occupied.data !== undefined && available.data !== undefined
      ? total.data - occupied.data - available.data
      : undefined;

  const indicators: { key: string; label: string; icon: LucideIcon; value: number | undefined }[] = [
    { key: 'total', label: 'Total de unidades', icon: DoorOpen, value: total.data },
    { key: 'occupied', label: 'Unidades ocupadas', icon: Home, value: occupied.data },
    { key: 'available', label: 'Unidades disponiveis', icon: KeyRound, value: available.data },
  ];

  return (
    <section aria-label="Indicadores de ocupacao" className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {indicators.map(({ key, label, icon: Icon, value }) => (
          <div key={key} className="app-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            {loading || value === undefined ? (
              <Skeleton className="mt-3 h-8 w-20" />
            ) : (
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                {formatNumber(value)}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {/*
          Com filtros ativos, a lista mostra um subconjunto e os indicadores nao:
          sem dizer isso, os numeros seriam lidos como o total filtrado.
        */}
        {filtersActive
          ? 'Indicadores de todo o condominio selecionado; os filtros da lista nao se aplicam a eles.'
          : 'Indicadores de todo o condominio selecionado.'}
        {others !== undefined && others > 0
          ? ` Outras ${formatNumber(others)} em reforma ou bloqueadas completam o total.`
          : ''}
      </p>
    </section>
  );
}
