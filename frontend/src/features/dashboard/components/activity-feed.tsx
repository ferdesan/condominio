import { History } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatRelative } from '@/lib/format';
import { initials } from '@/lib/utils';
import type { ActivityEntry } from '@/types/api';

export function ActivityFeed({ data, loading }: { data: ActivityEntry[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
        <CardDescription>Ultimos registros da trilha de auditoria.</CardDescription>
      </CardHeader>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon={History} title="Nenhuma atividade registrada" />
        ) : (
          <ul className="space-y-3">
            {data.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {initials(entry.userName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.userName ?? 'Sistema'} · {formatRelative(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
