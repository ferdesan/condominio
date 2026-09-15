import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Tenant } from '@/types/tenant';
import { useUpdateTenant } from '../tenant-hooks';
import {
  GRACE_DAYS_MAX,
  PERCENT_MAX,
  TENANT_FIELDS,
  tenantSchema,
  toTenantFormValues,
  toTenantPayload,
  type TenantFormValues,
} from '../tenant-schema';

export interface TenantSettingsFormProps {
  tenant: Tenant;
  /** Sem `tenant:update` a tela le e nao edita. */
  canUpdate: boolean;
}

/**
 * Identificacao e politica de encargos — **um formulario**, porque e uma rota.
 *
 * Os dois assuntos aparecem em cartoes separados por serem separados para quem
 * le, mas `PATCH /tenants/me` e um so: dois botoes "Salvar" apontando para o
 * mesmo endereco deixariam metade do formulario suja depois de gravar a outra
 * metade. E a diferenca para a tela de perfil, que tem tres blocos porque tem
 * tres rotas com efeitos distintos.
 *
 * **Cinco campos nao estao aqui, e nao e esquecimento.** `plan`, `status`,
 * `maxCondominiums`, `maxUsers` e `slug` sao recusados com 403 por
 * `tenantService.update` para quem nao e super-admin. Eles aparecem como
 * leitura em `PlanSummary`, com a nota de quem os altera.
 */
export function TenantSettingsForm({ tenant, canUpdate }: TenantSettingsFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: toTenantFormValues(tenant),
  });

  const update = useUpdateTenant({
    onSuccess: (saved) => {
      // `reset` com o que o servidor devolveu zera o `isDirty` e mostra o valor
      // normalizado por ele — o CNPJ volta so com digitos, por exemplo.
      reset(toTenantFormValues(saved));
      setFormError(null);
      toast.success('Configuracoes salvas.');
    },
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, TENANT_FIELDS),
  });

  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // A falha ja foi apresentada por `onError`; aqui so nao se deixa a promessa
    // rejeitar sem dono.
    await update.mutateAsync(toTenantPayload(values)).catch(() => undefined);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/*
        Um `fieldset` desabilitado cobre os controles de uma vez e deixa o
        estado explicito na arvore de acessibilidade — melhor do que repetir
        `disabled` em cada `Input` e esquecer um.
      */}
      <fieldset disabled={!canUpdate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificacao</CardTitle>
            <CardDescription>
              Como a administradora aparece nos documentos e nas comunicacoes do sistema.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField id="tenant-name" label="Nome" error={errors.name?.message}>
              {(aria) => <Input maxLength={150} {...aria} {...register('name')} />}
            </FormField>

            <FormField
              id="tenant-document"
              label="CNPJ"
              error={errors.document?.message}
              description="Opcional. Catorze digitos."
            >
              {(aria) => <Input maxLength={18} {...aria} {...register('document')} />}
            </FormField>

            <FormField
              id="tenant-email"
              label="E-mail"
              error={errors.email?.message}
              description="Opcional. Contato da administradora, e nao o seu."
            >
              {(aria) => <Input type="email" maxLength={180} {...aria} {...register('email')} />}
            </FormField>

            <FormField
              id="tenant-phone"
              label="Telefone"
              error={errors.phone?.message}
              description="Opcional."
            >
              {(aria) => <Input maxLength={20} {...aria} {...register('phone')} />}
            </FormField>

            <FormField
              id="tenant-logo"
              label="Logo"
              error={errors.logoUrl?.message}
              description="Opcional. URL completa de uma imagem ja hospedada — nao ha upload."
              className="sm:col-span-2"
            >
              {(aria) => (
                <Input
                  type="url"
                  maxLength={255}
                  placeholder="https://..."
                  {...aria}
                  {...register('logoUrl')}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Politica de encargos</CardTitle>
            <CardDescription>
              O que se aplica a uma cobranca vencida. Estes tres valores sao os que o botao
              &ldquo;aplicar encargos&rdquo;, na tela de Financeiro, usa ao percorrer as cobrancas
              em atraso — nao ha outro lugar onde eles sejam definidos.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="tenant-grace-days"
              label="Carencia"
              error={errors.chargeGraceDays?.message}
              description={`Dias apos o vencimento antes de qualquer encargo. 0 a ${GRACE_DAYS_MAX}.`}
            >
              {(aria) => (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={GRACE_DAYS_MAX}
                  step={1}
                  {...aria}
                  {...register('chargeGraceDays')}
                />
              )}
            </FormField>

            {/*
              Os dois percentuais sao `type="text"`, e a carencia acima nao.
              A diferenca e o separador decimal: num `input type="number"` a
              virgula e descartada pelo navegador, e "1,5" digitado vira "15" —
              juros de quinze por cento no lugar de um e meio, sem nenhum aviso.
              A carencia e inteira e nao corre esse risco, entao mantem o
              controle numerico. `inputMode="decimal"` preserva o teclado certo
              no celular; a faixa continua conferida pelo schema.
            */}
            <FormField
              id="tenant-penalty"
              label="Multa (%)"
              error={errors.latePenaltyPercent?.message}
              description={`Percentual unico sobre o valor. 0 a ${PERCENT_MAX}. Use virgula ou ponto.`}
            >
              {(aria) => (
                <Input
                  type="text"
                  inputMode="decimal"
                  maxLength={6}
                  {...aria}
                  {...register('latePenaltyPercent')}
                />
              )}
            </FormField>

            <FormField
              id="tenant-interest"
              label="Juros (% ao mes)"
              error={errors.lateInterestPercent?.message}
              description={`Proporcional aos dias de atraso. 0 a ${PERCENT_MAX}. Use virgula ou ponto.`}
            >
              {(aria) => (
                <Input
                  type="text"
                  inputMode="decimal"
                  maxLength={6}
                  {...aria}
                  {...register('lateInterestPercent')}
                />
              )}
            </FormField>
          </CardContent>
        </Card>
      </fieldset>

      {formError ? (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      {canUpdate ? (
        <div className="flex justify-end">
          {/* Desabilitado sem alteracao: um PATCH que nao muda nada ainda
              gravaria um registro de auditoria e confundiria a trilha. */}
          <Button type="submit" loading={pending} disabled={!isDirty}>
            Salvar
          </Button>
        </div>
      ) : null}
    </form>
  );
}
