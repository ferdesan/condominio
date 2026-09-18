import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={Compass}
          title="Pagina não encontrada"
          description="O endereço acessado não existe ou foi movido."
          action={
            <Button asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
