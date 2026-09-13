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
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Condominium } from '@/types/api';
import { condominiumHooks } from '../condominium-hooks';
import {
  CONDOMINIUM_FIELDS,
  CONDOMINIUM_FORM_DEFAULTS,
  condominiumSchema,
  toCondominiumFormValues,
  toCondominiumPayload,
  type CondominiumFormValues,
} from '../condominium-schema';

const TYPE_LABELS: Record<CondominiumFormValues['type'], string> = {
  RESIDENTIAL: 'Residencial',
  COMMERCIAL: 'Comercial',
  MIXED: 'Misto',
};

const STATUS_LABELS: Record<CondominiumFormValues['status'], string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

/**
 * O conflito de CNPJ e o unico erro cuja saida nao esta na propria mensagem: o
 * registro existente pode estar removido, e ai o caminho e restaurar, nao criar
 * outro. O servidor distingue os dois 409 pelo codigo — conflito de unicidade
 * contra violacao de regra de negocio — entao e por ele que decidimos.
 */
const CONFLICT_HINT =
  'Se o condominio ja existiu e foi removido, restaure o registro em vez de cadastrar outro: ative "Incluir removidos" na listagem.';

export interface CondominiumFormDialogProps {
  /** Ausente cadastra; presente edita. */
  condominium?: Condominium;
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
export function CondominiumFormDialog({ condominium, onClose }: CondominiumFormDialogProps) {
  const isEdit = Boolean(condominium);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictHint, setConflictHint] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CondominiumFormValues>({
    resolver: zodResolver(condominiumSchema),
    defaultValues: condominium
      ? toCondominiumFormValues(condominium)
      : CONDOMINIUM_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['condominiums'] });
      onClose();
      return;
    }
    setConflictHint(error.code === 'CONFLICT');
    applyApiError(error, setError, setFormError, CONDOMINIUM_FIELDS);
  }

  const create = condominiumHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = condominiumHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setConflictHint(false);
    const data = toCondominiumPayload(values);
    const request = condominium
      ? update.mutateAsync({ id: condominium.id, data })
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
            <DialogTitle>{isEdit ? 'Editar condominio' : 'Novo condominio'}</DialogTitle>
            <DialogDescription>
              Identificacao, endereco, contato e dados do sindico.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Identificacao">
              <FormField
                id="name"
                label="Nome"
                error={errors.name?.message}
                className="sm:col-span-2"
              >
                {(aria) => <Input autoFocus {...aria} {...register('name')} />}
              </FormField>

              <FormField
                id="document"
                label="CNPJ"
                error={errors.document?.message}
                description="14 digitos."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('document')} />}
              </FormField>

              <Controller
                control={control}
                name="type"
                render={({ field, fieldState }) => (
                  <FormField id="type" label="Tipo" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
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

              <FormField
                id="chargeDueDay"
                label="Dia de vencimento"
                error={errors.chargeDueDay?.message}
                description="Entre 1 e 28."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('chargeDueDay')} />}
              </FormField>
            </FormSection>

            <FormSection title="Endereco">
              <FormField
                id="zipCode"
                label="CEP"
                error={errors.zipCode?.message}
                description="8 digitos."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('zipCode')} />}
              </FormField>

              <FormField
                id="street"
                label="Logradouro"
                error={errors.street?.message}
                className="sm:col-span-2"
              >
                {(aria) => <Input {...aria} {...register('street')} />}
              </FormField>

              <FormField id="number" label="Numero" error={errors.number?.message}>
                {(aria) => <Input {...aria} {...register('number')} />}
              </FormField>

              <FormField id="complement" label="Complemento" error={errors.complement?.message}>
                {(aria) => <Input {...aria} {...register('complement')} />}
              </FormField>

              <FormField id="district" label="Bairro" error={errors.district?.message}>
                {(aria) => <Input {...aria} {...register('district')} />}
              </FormField>

              <FormField id="city" label="Cidade" error={errors.city?.message}>
                {(aria) => <Input {...aria} {...register('city')} />}
              </FormField>

              <FormField id="state" label="UF" error={errors.state?.message}>
                {(aria) => <Input maxLength={2} {...aria} {...register('state')} />}
              </FormField>
            </FormSection>

            <FormSection title="Contato">
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

              <FormField
                id="email"
                label="E-mail"
                error={errors.email?.message}
                className="sm:col-span-2"
              >
                {(aria) => <Input type="email" {...aria} {...register('email')} />}
              </FormField>

              <FormField
                id="logoUrl"
                label="URL do logotipo"
                error={errors.logoUrl?.message}
                className="sm:col-span-3"
              >
                {(aria) => <Input {...aria} {...register('logoUrl')} />}
              </FormField>
            </FormSection>

            <FormSection title="Sindico">
              <FormField id="syndicName" label="Nome do sindico" error={errors.syndicName?.message}>
                {(aria) => <Input {...aria} {...register('syndicName')} />}
              </FormField>

              <Controller
                control={control}
                name="syndicPhone"
                render={({ field, fieldState }) => (
                  <FormField
                    id="syndicPhone"
                    label="Telefone do sindico"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <PhoneInput value={field.value} onChange={field.onChange} {...aria} />
                    )}
                  </FormField>
                )}
              />

              {/*
                Campo `date` no servidor, que devolve e aceita `YYYY-MM-DD`. O
                input nativo fala exatamente esse formato; passar pelo `DatePicker`
                obrigaria a converter para `Date` e voltar, o que desloca a data em
                um dia em fusos negativos.
              */}
              <FormField
                id="syndicTermEndsAt"
                label="Fim do mandato"
                error={errors.syndicTermEndsAt?.message}
              >
                {(aria) => <Input type="date" {...aria} {...register('syndicTermEndsAt')} />}
              </FormField>
            </FormSection>

            <FormSection title="Observacoes" columns={1}>
              <FormField id="notes" label="Observacoes" error={errors.notes?.message}>
                {(aria) => <Textarea {...aria} {...register('notes')} />}
              </FormField>
            </FormSection>

            {formError ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <p>{formError}</p>
                {conflictHint ? <p className="mt-1 text-xs">{CONFLICT_HINT}</p> : null}
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
