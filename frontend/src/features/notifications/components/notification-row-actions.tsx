import { ExternalLink, MailOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ICON_BUTTON_SIZE, ICON_BUTTON_TONE } from '@/components/ui/icon-button-variants';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types/notification';
import { NO_DESTINATION, notificationLabel } from '../notification-labels';
import { resolveActionUrl } from '../notification-links';

export interface NotificationRowActionsProps {
  notification: AppNotification;
  /** Marcar como lida exige `notification:update`; abrir a origem e leitura. */
  canUpdate: boolean;
  /** Recusa do servidor, apresentada na propria linha que a provocou. */
  error?: string;
  onMarkAsRead: (notification: AppNotification) => void;
}

/**
 * As duas acoes de uma notificacao: ir para a tela que a originou e dar a
 * leitura por feita.
 *
 * Marcar so aparece enquanto ha o que marcar — o ciclo e linear e sem volta
 * (nao lida -> lida), e o servidor nao tem rota para desfazer. Esta e a mesma
 * excecao ja aplicada em Comunicados e Manutencoes, e pelas mesmas duas
 * condicoes: o ciclo nao retorna e a acao repetida nao teria efeito
 * (`markAsRead` filtra `read_at IS NULL` e devolveria zero).
 *
 * O destino de "Abrir" sai de `resolveActionUrl`, nao do `actionUrl` cru:
 * o servidor grava caminhos que o roteador pode nao ter. Sem destino resolvivel,
 * o link nao e oferecido — prometer navegacao e entregar tela em branco e pior
 * do que dizer que nao ha para onde ir.
 *
 * Cada rotulo acessivel carrega o assunto da notificacao: numa tabela de vinte
 * linhas, "Abrir" sozinho nao diz qual.
 */
export function NotificationRowActions({
  notification,
  canUpdate,
  error,
  onMarkAsRead,
}: NotificationRowActionsProps) {
  const label = notificationLabel(notification);
  const destination = resolveActionUrl(notification.actionUrl);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          A origem continua ancora dentro de `Button asChild`: e navegacao, e
          trocar por `IconButton` viraria um `button`, perdendo "abrir em nova
          aba" e o endereco na barra de status. So o rotulo virou icone.
        */}
        {destination ? (
          <Button
            asChild
            variant="ghost"
            className={cn(ICON_BUTTON_SIZE, ICON_BUTTON_TONE.primary)}
          >
            <Link to={destination} aria-label={`Abrir origem de ${label}`}>
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{NO_DESTINATION}</span>
        )}

        {canUpdate && !notification.readAt ? (
          <IconButton
            icon={MailOpen}
            label={`Marcar ${label} como lida`}
            onClick={() => onMarkAsRead(notification)}
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
