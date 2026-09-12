import { Loader2 } from 'lucide-react';

export function FullPageLoader({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
