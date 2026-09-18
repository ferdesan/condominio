import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UNREAD_COUNT_LABEL } from '../notification-labels';

export interface NotificationSummaryProps {
  count: number | undefined;
  isPending: boolean;
  isError: boolean;
}

/**
 * Quantas notificacoes seguem sem leitura.
 *
 * O numero vem de `/notifications/unread-count`, que conta no banco, e nao das
 * linhas carregadas: a lista mostra uma pagina de vinte e um recorte de filtros,
 * entao conta-la responderia outra pergunta.
 *
 * **Zero e um resultado, e nao ausencia de resultado.** Esconder o indicador
 * quando a fila zera trocaria "nada pendente" por "nao sabemos", que sao coisas
 * diferentes para quem acabou de limpar a caixa.
 *
 * Regiao nomeada: o indicador e um bloco proprio, navegavel sem atravessar a
 * lista inteira.
 */
export function NotificationSummary({ count, isPending, isError }: NotificationSummaryProps) {
  return (
    <Card role="region" aria-labelledby="notifications-summary-title" className="p-4">
      <h2 id="notifications-summary-title" className="text-sm font-semibold">
        Resumo da central
      </h2>

      {isError ? (
        // A falha fica contida: a lista continua utilizavel sem o indicador.
        <p role="alert" className="mt-2 text-sm text-destructive">
          Não foi possível carregar a contagem. A lista continua disponível.
        </p>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">{UNREAD_COUNT_LABEL}</p>
          {/* O esqueleto ocupa o mesmo espaco do numero: a area nao pula ao carregar. */}
          {isPending ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{count ?? 0}</p>
          )}
        </div>
      )}
    </Card>
  );
}
