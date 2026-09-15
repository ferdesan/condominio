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
import { CurrencyInput } from '@/components/ui/currency-input';
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
import type { Employee } from '@/types/api';
import { employeeHooks } from '../employee-hooks';
import {
  EMPLOYEE_FIELDS,
  EMPLOYEE_FORM_DEFAULTS,
  employeeSchema,
  toEmployeeFormValues,
  toEmployeePayload,
  type EmployeeFormValues,
} from '../employee-schema';
import { CONTRACT_TYPE_LABELS, STATUS_LABELS } from '../employee-labels';

export interface EmployeeFormDialogProps {
  /** Ausente cadastra; presente edita. */
  employee?: Employee;
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
export function EmployeeFormDialog({ employee, condominiumId, onClose }: EmployeeFormDialogProps) {
  const isEdit = Boolean(employee);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee ? toEmployeeFormValues(employee) : EMPLOYEE_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, EMPLOYEE_FIELDS);
  }

  const create = employeeHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = employeeHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toEmployeePayload(values, condominiumId);
    const request = employee
      ? update.mutateAsync({ id: employee.id, data })
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
            <DialogTitle>{isEdit ? 'Editar funcionario' : 'Novo funcionario'}</DialogTitle>
            <DialogDescription>
              Dados pessoais, contato, vinculo contratual e observacoes.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Dados pessoais">
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
                label="CPF"
                error={errors.document?.message}
                description="11 digitos."
              >
                {(aria) => <Input inputMode="numeric" {...aria} {...register('document')} />}
              </FormField>

              <FormField
                id="photoUrl"
                label="URL da foto"
                error={errors.photoUrl?.message}
                className="sm:col-span-3"
              >
                {(aria) => <Input {...aria} {...register('photoUrl')} />}
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
            </FormSection>

            <FormSection title="Vinculo">
              <FormField id="position" label="Cargo" error={errors.position?.message}>
                {(aria) => <Input {...aria} {...register('position')} />}
              </FormField>

              <FormField
                id="department"
                label="Departamento"
                error={errors.department?.message}
                description="Portaria, limpeza, manutencao, administracao."
              >
                {(aria) => <Input {...aria} {...register('department')} />}
              </FormField>

              <Controller
                control={control}
                name="contractType"
                render={({ field, fieldState }) => (
                  <FormField
                    id="contractType"
                    label="Tipo de contrato"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
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
                id="workSchedule"
                label="Escala de trabalho"
                error={errors.workSchedule?.message}
                description="Ex.: 12x36 noturno."
              >
                {(aria) => <Input {...aria} {...register('workSchedule')} />}
              </FormField>

              {/*
                Dinheiro tem campo proprio: o `CurrencyInput` guarda numero e
                apresenta a moeda formatada, entao o corpo da requisicao sai
                numerico sem ninguem converter texto no caminho.
              */}
              <Controller
                control={control}
                name="salary"
                render={({ field, fieldState }) => (
                  <FormField
                    id="salary"
                    label="Salario"
                    error={fieldState.error?.message}
                    description="Opcional. Dado sensivel: informe apenas se for necessario."
                  >
                    {(aria) => (
                      <CurrencyInput value={field.value} onChange={field.onChange} {...aria} />
                    )}
                  </FormField>
                )}
              />

              {/*
                Colunas `date` no servidor, que devolve e aceita `YYYY-MM-DD`. O
                input nativo fala exatamente esse formato; passar pelo
                `DatePicker` obrigaria a converter para `Date` e voltar, o que
                desloca a data em um dia em fusos negativos.
              */}
              <FormField id="admissionDate" label="Admissao" error={errors.admissionDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('admissionDate')} />}
              </FormField>

              <FormField
                id="terminationDate"
                label="Desligamento"
                error={errors.terminationDate?.message}
              >
                {(aria) => <Input type="date" {...aria} {...register('terminationDate')} />}
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
