import { useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import type { UserSession } from '@/types/profile';
import { useLogoutAll, useSessions } from '../profile-hooks';
import { browserLabel, shortSessionId } from '../profile-labels';

/**
 * Onde a conta esta aberta, e o botao que fecha tudo.
 *
 * **Nao ha acao por linha.** O servidor so oferece `revokeAllForUser` — revogar
 * uma sessao especifica nao existe em `auth.routes.ts` —, entao um botao
 * "encerrar esta" na linha teria de mentir sobre o alcance. A unica acao e a que
 * o servidor realmente faz.
 *
 * **A linha atual nao e destacada.** `listSessions` devolve `id`, `sessionId`,
 * datas, IP e user agent; nada que identifique qual delas e a que esta lendo a
 * tela — o `sessionId` do token nao chega ao cliente. Marcar uma linha como
 * "esta" seria um palpite pelo user agent, que empata entre abas do mesmo
 * navegador. Como a acao encerra todas, a distincao tambem nao mudaria nada.
 *
 * **Sessoes vencidas ainda aparecem.** O filtro do servidor e por `revokedAt`
 * nulo, e nao por validade, entao uma linha pode estar expirada ate a rotina de
 * limpeza passar. Por isso a coluna de expiracao existe: escondida, a lista
 * pareceria maior do que o acesso realmente aberto.
 */
export function SessionsPanel() {
  const { logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const query = useSessions();

  const logoutAll = useLogoutAll({
    onSuccess: () => {
      toast.success('Todas as sessoes foram encerradas.');
      void logout();
    },
    onError: () => setConfirmOpen(false),
  });

  const sessions = query.data ?? [];

  const columns: Column<UserSession>[] = [
    {
      key: 'userAgent',
      label: 'Dispositivo',
      render: (_value, row) => (
        <div>
          <p>{browserLabel(row.userAgent)}</p>
          <p className="text-xs text-muted-foreground">{shortSessionId(row.sessionId)}</p>
        </div>
      ),
    },
    {
      key: 'ipAddress',
      label: 'Endereco IP',
      // Ausente quando o proxy nao repassou o cabecalho; o traco diz isso sem
      // sugerir que a sessao veio de lugar nenhum.
      render: (_value, row) => row.ipAddress ?? '—',
    },
    {
      key: 'createdAt',
      label: 'Iniciada',
      render: (_value, row) => (
        <div className="whitespace-nowrap">
          <p>{formatDateTime(row.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{formatRelative(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'expiresAt',
      label: 'Expira',
      render: (_value, row) => (
        <span className="whitespace-nowrap">{formatDateTime(row.expiresAt)}</span>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sessoes ativas</CardTitle>
          <CardDescription>
            Onde sua conta esta aberta. O servidor guarda as vinte mais recentes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {query.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              Nao foi possivel carregar as sessoes. {query.error.message}
            </div>
          ) : sessions.length === 0 ? (
            // Improvavel e nao impossivel: a sessao que le esta tela tem um
            // refresh token, mas ele pode ter sido revogado noutra aba.
            <EmptyState
              icon={MonitorSmartphone}
              title="Nenhuma sessao ativa"
              description="Nenhum acesso aberto foi encontrado para esta conta."
            />
          ) : (
            <DataTable columns={columns} data={sessions} idKey="id" searchable={false} />
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={sessions.length === 0 || query.isPending}
              loading={logoutAll.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Encerrar todas as sessoes
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Encerrar todas as sessoes?"
        description="Inclusive esta. Voce sera desconectado e precisara entrar de novo em cada dispositivo."
        actionLabel="Encerrar tudo"
        cancelLabel="Cancelar"
        variant="warning"
        loading={logoutAll.isPending}
        onConfirm={() => logoutAll.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
