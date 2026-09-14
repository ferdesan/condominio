import { Mail, MailOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { READ_LABEL, UNREAD_LABEL } from '../notification-labels';

export interface NotificationReadBadgeProps {
  /** Ausente enquanto nao lida; e o unico sinal de leitura que o servidor grava. */
  readAt: string | null;
}

/**
 * Lida e nao lida se distinguem por texto e icone, e nao so por cor: quem nao
 * enxerga a diferenca entre os tons precisa da mesma informacao.
 */
export function NotificationReadBadge({ readAt }: NotificationReadBadgeProps) {
  if (readAt) {
    return (
      <Badge variant="neutral" className="gap-1">
        <MailOpen className="size-3" aria-hidden="true" />
        {READ_LABEL}
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1">
      <Mail className="size-3" aria-hidden="true" />
      {UNREAD_LABEL}
    </Badge>
  );
}
