import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { Tenant } from '@/types/tenant';
import { PLAN_LABELS, PLATFORM_ONLY, TENANT_STATUS_LABELS } from '../tenant-labels';

export interface PlanSummaryProps {
  tenant: Tenant;
}

/**
 * Plano, situacao e limites — **somente leitura, e nao por escolha de tela**.
 *
 * `tenantService.update` recusa `plan`, `status`, `maxCondominiums`,
 * `maxUsers` e `slug` com **403** para quem nao e super-admin. Um campo
 * editavel aqui falharia em todo salvamento; um campo desabilitado prometeria
 * uma edicao que a permissao nunca destrava. Sao dados, com a nota de quem os
 * altera.
 *
 * Mostra-los importa: os limites governam quantos condominios e usuarios a
 * administradora pode cadastrar, e quem esbarrar neles precisa saber onde
 * estao antes de entender a recusa.
 */
export function PlanSummary({ tenant }: PlanSummaryProps) {
  const statusVariant =
    tenant.status === 'ACTIVE'
      ? 'success'
      : tenant.status === 'SUSPENDED'
        ? 'warning'
        : 'destructive';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano e limites</CardTitle>
        <CardDescription>{PLATFORM_ONLY}</CardDescription>
      </CardHeader>

      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Plano">
            <Badge variant="neutral">{PLAN_LABELS[tenant.plan] ?? tenant.plan}</Badge>
          </Field>

          <Field label="Situação">
            {/* A tarja carrega o texto; a cor reforca sem ser a unica pista. */}
            <Badge variant={statusVariant}>
              {TENANT_STATUS_LABELS[tenant.status] ?? tenant.status}
            </Badge>
          </Field>

          <Field label="Identificador">
            <span className="font-mono text-sm">{tenant.slug}</span>
          </Field>

          <Field label="Limite de condomínios">{tenant.maxCondominiums}</Field>
          <Field label="Limite de usuários">{tenant.maxUsers}</Field>

          {/* So existe enquanto o plano e de avaliacao; ausente, a linha some
              em vez de mostrar um traco que nao significa nada. */}
          {tenant.trialEndsAt ? (
            <Field label="Avaliação até">{formatDate(tenant.trialEndsAt)}</Field>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="text-sm text-muted-foreground">{children}</dd>
    </div>
  );
}
