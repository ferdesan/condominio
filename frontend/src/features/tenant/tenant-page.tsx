import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { useAuth } from '@/hooks/use-auth';
import { TenantSettingsForm } from './components/tenant-settings-form';
import { PlanSummary } from './components/plan-summary';
import { useTenant } from './tenant-hooks';

const DESCRIPTION =
  'O cadastro da administradora e a politica de encargos que vale para todos os condominios dela. Nao depende do condominio selecionado.';

/**
 * Configuracoes da administradora.
 *
 * **Por tenant, e nao por condominio** — como Usuarios e Auditoria. O recurso e
 * a raiz do isolamento multi-tenant, entao nada aqui herda o seletor do shell.
 *
 * **Duas permissoes, dois comportamentos.** `tenant:read` abre a tela;
 * `tenant:update` libera a edicao. Nao e uma distincao inventada: a matriz
 * semeada em `backend/src/shared/constants/roles.ts` da as duas ao ADMIN e so a
 * leitura ao SINDICO, que precisa conhecer a politica de encargos aplicada as
 * cobrancas do predio sem poder muda-la.
 *
 * **Por que esta tela existe.** `charge.service.ts` le a carencia, a multa e os
 * juros de `tenant.settings` ao aplicar encargos, e ate aqui nao havia onde
 * defini-los: os valores vinham da semente ou do padrao embutido no codigo. O
 * botao que aplica os encargos estava na tela de Financeiro; a regra que ele
 * aplica nao estava em lugar nenhum.
 */
export function TenantPage() {
  const { can } = useAuth();
  const query = useTenant();

  const canUpdate = can('tenant:update');

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description={DESCRIPTION} />

      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p>Nao foi possivel carregar as configuracoes. {query.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <TenantSettingsForm tenant={query.data} canUpdate={canUpdate} />
          <PlanSummary tenant={query.data} />
        </>
      )}
    </div>
  );
}
