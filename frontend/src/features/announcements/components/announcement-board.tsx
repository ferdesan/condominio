import { Eye, Megaphone, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { formatDate, formatNumber } from '@/lib/format';
import type { Announcement } from '@/types/announcement';
import { useAnnouncementBoard } from '../announcement-hooks';
import { CATEGORY_LABELS } from '../announcement-labels';

export interface AnnouncementBoardProps {
  condominiumId: string | null;
}

/**
 * O mural: o que esta publicado agora, na ordem em que as pessoas veem.
 *
 * **Nao duplica a listagem abaixo.** A listagem administrativa mostra rascunho,
 * arquivado e removido, pagina e filtra; o mural vem de `/announcements/board`,
 * que aplica tres regras que nenhum filtro da tela alcanca: exclui os
 * **expirados**, ordena os **fixados** primeiro e corta em vinte. Sem ele, um
 * comunicado vencido continuaria parecendo estar no ar.
 *
 * **`readsCount` e um contador de visualizacoes, e nao "lido por voce".**
 * `announcementService.markAsRead` chama `incrementReads`, que soma 1 numa
 * coluna do comunicado — nao ha registro de quem leu. Por isso a coluna se chama
 * "visualizacoes" e nao ha marcador de lido/nao lido em lugar nenhum: o dado
 * para sustentar essa distincao nao existe no servidor.
 *
 * **E por isso esta tela nao chama `POST /:id/read`.** Cada abertura daqui seria
 * de um administrador conferindo o mural, e o contador — o unico numero de
 * alcance que o produto tem — deixaria de medir leitura de morador. A rota
 * pertence ao portal que ainda nao existe.
 */
export function AnnouncementBoard({ condominiumId }: AnnouncementBoardProps) {
  const query = useAnnouncementBoard(condominiumId);
  const items = query.data ?? [];

  return (
    // `role="region"` com o titulo como rotulo: o mesmo arranjo de
    // `FinancialSummary`, para que o painel seja alcancavel como marco de
    // navegacao sem repetir o texto num `aria-label`.
    <Card role="region" aria-labelledby="announcement-board-title">
      <CardHeader>
        <CardTitle id="announcement-board-title">No ar agora</CardTitle>
        <CardDescription>
          Comunicados publicados e ainda vigentes, fixados primeiro — a ordem em que os moradores
          os veem. Ate vinte.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Nao foi possivel carregar o mural. {query.error.message}
          </p>
        ) : items.length === 0 ? (
          // Distinto de "nenhum comunicado cadastrado": pode haver rascunhos e
          // arquivados na lista abaixo e nada vigente no mural.
          <EmptyState
            icon={Megaphone}
            title="Nada publicado no momento"
            description="Nenhum comunicado vigente para este condominio. Rascunhos e arquivados aparecem na lista abaixo."
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <BoardItem key={item.id} announcement={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BoardItem({ announcement }: { announcement: Announcement }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {/*
            O icone tem rotulo acessivel e a tarja diz por extenso: o destaque
            nao pode depender so de posicao ou cor. Mesma decisao da listagem.
          */}
          {announcement.pinned ? (
            <Pin className="size-3.5 shrink-0 text-primary" aria-label="Fixado" />
          ) : null}
          <span className="font-medium">{announcement.title}</span>
          <Badge variant="neutral">
            {CATEGORY_LABELS[announcement.category] ?? announcement.category}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>

        <p className="text-xs text-muted-foreground">
          {announcement.publishedAt
            ? `Publicado em ${formatDate(announcement.publishedAt)}`
            : 'Sem data de publicacao'}
          {announcement.expiresAt ? ` · vence em ${formatDate(announcement.expiresAt)}` : ''}
        </p>
      </div>

      {/*
        "Visualizacoes", e nao "leituras": o contador soma toda abertura, sem
        distinguir pessoa nem repeticao.
      */}
      <span
        className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground"
        title="Visualizacoes registradas"
      >
        <Eye className="size-4" aria-hidden="true" />
        <span className="tabular-nums">{formatNumber(announcement.readsCount)}</span>
        <span className="sr-only">visualizacoes</span>
      </span>
    </li>
  );
}
