import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { ServiceProvider } from '@/types/api';
import { serviceProviderHooks } from '../service-provider-hooks';
import {
  SERVICE_PROVIDER_FIELDS,
  SERVICE_PROVIDER_FORM_DEFAULTS,
  serviceProviderSchema,
  toServiceProviderFormValues,
  toServiceProviderPayload,
  type ServiceProviderFormValues,
} from '../service-provider-schema';
import { STATUS_LABELS } from '../service-provider-labels';
import { ProviderRating } from './provider-rating';

export interface ServiceProviderFormDialogProps {
  /** Ausente cadastra; presente edita. */
  provider?: ServiceProvider;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  onClose: () => void;
}

/**
 * Cadastro e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 */
export function ServiceProviderFormDialog({
  provider,
  condominiumId,
  onClose,
}: ServiceProviderFormDialogProps) {
  const isEdit = Boolean(provider);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ServiceProviderFormValues>({
    resolver: zodResolver(serviceProviderSchema),
    defaultValues: provider
      ? toServiceProviderFormValues(provider)
      : SERVICE_PROVIDER_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, SERVICE_PROVIDER_FIELDS);
  }

  const create = serviceProviderHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = serviceProviderHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toServiceProviderPayload(values, condominiumId);
    const request = provider
      ? update.mutateAsync({ id: provider.id, data })
      : create.mutateAsync(data);
    // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
    // promessa rejeitar sem dono.
    await request.catch(() => undefined);
  });

  /** Descartar o que foi digitado precisa ser uma escolha, nao um clique fora. */
  function requestClose(): void {
    if (isDirty && !pending) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  // A previa acompanha o que esta digitado, entao a nota se le como avaliacao
  // tambem no formulario. Fora da faixa nao ha previa — ha a objecao do campo.
  const typedRating = watch('rating');
  const ratingPreview = /^[1-5]$/.test(typedRating) ? Number(typedRating) : null;

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar prestador' : 'Novo prestador'}</DialogTitle>
            <DialogDescription>
              Identificacao, servico prestado, contato e vigencia do contrato.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Identificacao">
              <FormField
                id="companyName"
                label="Razao social"
                error={errors.companyName?.message}
                className="sm:col-span-2"
              >
                {(aria) => <Input autoFocus {...aria} {...register('companyName')} />}
              </FormField>

              <FormField id="tradeName" label="Nome fantasia" error={errors.tradeName?.message}>
                {(aria) => <Input {...aria} {...register('tradeName')} />}
              </FormField>

              {/*
                O unico campo do cadastro que aceita dois formatos: prestador
                pessoa fisica entra com CPF, empresa com CNPJ, e a validacao
                cobre os dois — como a formatacao na listagem.
              */}
              <FormField
                id="document"
                label="CPF ou CNPJ"
                error={errors.document?.message}
                description="11 digitos para CPF, 14 para CNPJ."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('document')} />}
              </FormField>
            </FormSection>

            <FormSection title="Servico">
              <FormField
                id="serviceType"
                label="Tipo de servico"
                error={errors.serviceType?.message}
              >
                {(aria) => <Input {...aria} {...register('serviceType')} />}
              </FormField>

              <Controller
                control={control}
                name="status"
                render={({ field, fieldState }) => (
                  <FormField id="status" label="Status" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />

              {/* A previa ao lado do campo diz de quanto e a nota; o numero sozinho nao. */}
              <FormField
                id="rating"
                label="Avaliacao"
                error={errors.rating?.message}
                description="De 1 (ruim) a 5 (excelente)."
              >
                {(aria) => (
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      inputMode="numeric"
                      className="w-24"
                      {...aria}
                      {...register('rating')}
                    />
                    <ProviderRating value={ratingPreview} />
                  </div>
                )}
              </FormField>
            </FormSection>

            <FormSection title="Contato">
              <FormField
                id="contactName"
                label="Nome do contato"
                error={errors.contactName?.message}
              >
                {(aria) => <Input {...aria} {...register('contactName')} />}
              </FormField>

              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <FormField id="phone" label="Telefone" error={fieldState.error?.message}>
                    {(aria) => (
                      <PhoneInput value={field.value} onChange={field.onChange} {...aria} />
                    )}
                  </FormField>
                )}
              />

              <FormField id="email" label="E-mail" error={errors.email?.message}>
                {(aria) => <Input type="email" {...aria} {...register('email')} />}
              </FormField>
            </FormSection>

            {/*
              Colunas `date` no servidor, que devolve e aceita `YYYY-MM-DD`. O
              input nativo fala exatamente esse formato; passar pelo `DatePicker`
              obrigaria a converter para `Date` e voltar, o que desloca a data em
              um dia em fusos negativos.
            */}
            <FormSection title="Contrato">
              <FormField id="contractStart" label="Inicio" error={errors.contractStart?.message}>
                {(aria) => <Input type="date" {...aria} {...register('contractStart')} />}
              </FormField>

              <FormField id="contractEnd" label="Termino" error={errors.contractEnd?.message}>
                {(aria) => <Input type="date" {...aria} {...register('contractEnd')} />}
              </FormField>
            </FormSection>

            <FormField id="notes" label="Observacoes" error={errors.notes?.message}>
              {(aria) => <Textarea {...aria} {...register('notes')} />}
            </FormField>

            {formError ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <p>{formError}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {isEdit ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title="Descartar alteracoes?"
        description="As informacoes preenchidas serao perdidas."
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

function FormSection({
  title,
  columns = 3,
  children,
}: {
  title: string;
  columns?: 1 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">{title}</legend>
      <div className={columns === 1 ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-3'}>{children}</div>
    </fieldset>
  );
}
