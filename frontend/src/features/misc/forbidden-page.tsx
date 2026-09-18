import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Acesso negado"
      description="Seu perfil não tem permissao para ver esta área. Fale com o administrador do condomínio."
      action={
        <Button asChild variant="outline">
          <Link to="/">Voltar ao dashboard</Link>
        </Button>
      }
    />
  );
}
