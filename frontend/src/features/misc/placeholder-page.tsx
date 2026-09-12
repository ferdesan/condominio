import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

/**
 * Modulo previsto na navegacao cuja tela ainda nao foi construida. Mantem o
 * mapa do produto visivel e deixa explicito o que falta, em vez de esconder o
 * item do menu ou levar a uma rota quebrada.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Modulo em construcao"
        description={`A API de ${title.toLowerCase()} ja esta disponivel; a tela ainda sera implementada.`}
      />
    </>
  );
}
