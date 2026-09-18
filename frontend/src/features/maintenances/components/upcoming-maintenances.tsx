import { CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { useUpcomingMaintenances } from '../maintenance-hooks';
import { NO_ASSET, STATUS_LABELS } from '../maintenance-labels';

export interface UpcomingMaintenancesProps {
  condominiumId: string | null;
}

/**
 * O que esta por vir, de `GET /maintenances/upcoming`.
 *
 * O recorte e do servidor, e nao desta tela: ele devolve as dez ordens mais
 * proximas que ainda podem acontecer (`SCHEDULED`, `IN_PROGRESS`, `OVERDUE`),
 * ordenadas por data. Filtrar a pagina carregada responderia outra pergunta — a
 * lista mostra vinte linhas e um recorte de filtros, e a proxima ordem do predio
 * pode estar na pagina tres ou escondida por um filtro de tipo.
 *
 * Regiao nomeada, e nao so um bloco: os titulos das ordens se repetem na tabela
 * logo abaixo, e sem um nome para escopar nao ha como dizer de qual das duas
 * apresentacoes se esta falando — nem para quem navega por leitor, nem no teste.
 *
 * A consulta e separada da listagem para que uma falha aqui nao leve a tela
 * junto: a lista continua utilizavel com o destaque em erro.
 */
export function UpcomingMaintenances({ condominiumId }: UpcomingMaintenancesProps) {
  const upcoming = useUpcomingMaintenances(condominiumId);
  const rows = upcoming.data ?? [];

  return (
    <Card role="region" className="p-4" aria-labelledby="maintenance-upcoming-title">
      <div className="mb-3 flex items-start gap-2">
        <CalendarClock
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <h2 id="maintenance-upcoming-title" className="text-sm font-semibold">
            Proximas manutenções
          </h2>
          <p className="text-xs text-muted-foreground">
            As mais proximas do condomínio inteiro, independentes dos filtros aplicados na lista.
          </p>
        </div>
      </div>

      {upcoming.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as proximas manutenções. A lista continua disponível.
        </p>
      ) : upcoming.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada agendado adiante neste condomínio.</p>
      ) : (
        <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">
                <span className="font-medium">{row.title}</span>
                <span className="text-muted-foreground"> · {row.assetName ?? NO_ASSET}</span>
              </span>
              {/*
                A data e o estado juntos: uma ordem atrasada continua "por vir"
                para o servidor, e o destaque mentiria se não dissesse isso.
              */}
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatDateTime(row.scheduledFor)} · {STATUS_LABELS[row.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
