import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';

export function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Acesso negado"
      description="Seu perfil nao tem permissao para ver esta area. Fale com o administrador do condominio."
      action={
        <Button asChild variant="outline">
          <Link to="/">Voltar ao dashboard</Link>
        </Button>
      }
    />
  );
}
