import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useUpcomingAssemblies } from '../assembly-hooks';
import { ASSEMBLY_MODE_LABELS, ASSEMBLY_TYPE_LABELS } from '../assembly-labels';

export interface UpcomingAssembliesProps {
  condominiumId: string | null;
}

/**
 * O que esta por vir, de `GET /assemblies/upcoming`.
 *
 * Os registros vem do servidor ja recortados e ordenados — a consulta e dele, e
 * nao se refaz no cliente. E uma pergunta diferente da que a lista responde: a
 * lista mostra uma pagina com os filtros aplicados, e este bloco mostra o que
 * vem a seguir independentemente deles.
 *
 * A consulta e separada da listagem para que uma falha aqui nao leve a tela
 * junto: a lista continua utilizavel com o destaque em erro.
 */
export function UpcomingAssemblies({ condominiumId }: UpcomingAssembliesProps) {
  const upcoming = useUpcomingAssemblies(condominiumId);
  const rows = upcoming.data ?? [];

  return (
    // Regiao nomeada: o destaque e um bloco proprio, navegavel sem atravessar a
    // lista inteira — e o vocabulario aqui repete o da coluna de situacao, entao
    // sem o nome as consultas por texto ficariam ambiguas.
    <Card role="region" className="p-4" aria-labelledby="upcoming-assemblies-title">
      <div className="mb-3">
        <h2 id="upcoming-assemblies-title" className="text-sm font-semibold">
          Proximas assembleias
        </h2>
        <p className="text-xs text-muted-foreground">
          Convocações que ainda vao acontecer, independentes dos filtros da lista.
        </p>
      </div>

      {upcoming.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as proximas assembleias. A lista continua disponível.
        </p>
      ) : upcoming.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma convocação futura registrada para este condomínio.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((assembly) => (
            <li key={assembly.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{assembly.title}</span>
              <span className="text-muted-foreground">
                {ASSEMBLY_TYPE_LABELS[assembly.type]} · {ASSEMBLY_MODE_LABELS[assembly.mode]} ·{' '}
                {formatDateTime(assembly.scheduledAt)} ({formatRelative(assembly.scheduledAt)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
