import { useMemo, useState, type ReactNode } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Dependent, Resident } from '@/types/api';
import { dependentHooks } from '../dependent-hooks';
import {
  DEPENDENT_FIELDS,
  DEPENDENT_FORM_DEFAULTS,
  dependentSchema,
  toDependentFormValues,
  toDependentPayload,
  type DependentFormValues,
} from '../dependent-schema';
import { RELATIONSHIP_LABELS, unitLabel } from '../dependent-labels';

export interface DependentFormDialogProps {
  /** Ausente cadastra; presente edita. */
  dependent?: Dependent;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Moradores do condominio selecionado — a unica origem valida para o seletor. */
  residents: Resident[];
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
export function DependentFormDialog({
  dependent,
  condominiumId,
  residents,
  onClose,
}: DependentFormDialogProps) {
  const isEdit = Boolean(dependent);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<DependentFormValues>({
    resolver: zodResolver(dependentSchema),
    defaultValues: dependent ? toDependentFormValues(dependent) : DEPENDENT_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // Um 404 aqui tem duas origens: o dependente que sumiu enquanto o dialogo
    // estava aberto, e o morador titular que o servidor nao encontrou. So a
    // primeira e possivel numa edicao, e so nela insistir no formulario nao
    // leva a lugar nenhum. No cadastro o registro nunca existiu para sumir:
    // quem sumiu foi o morador, entao o seletor e que precisa ser recarregado.
    if (error.status === 404) {
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['dependents'] });
        onClose();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['residents'] });
    }
    applyApiError(error, setError, setFormError, DEPENDENT_FIELDS);
  }

  const create = dependentHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = dependentHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toDependentPayload(values, condominiumId);
    const request = dependent
      ? update.mutateAsync({ id: dependent.id, data })
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

  /**
   * A unidade nao e uma escolha: o servidor recusa um dependente que nao esteja
   * na unidade do morador titular. Escolher o morador e, portanto, escolher a
   * unidade — e o campo existe para mostrar qual, nao para divergir dela.
   */
  const residentId = watch('residentId');
  const selectedResident = residents.find((resident) => resident.id === residentId);
  const missingResident = residentId !== '' && selectedResident === undefined;
  const unit = selectedResident?.unit;

  /**
   * A unidade vai como segunda linha de cada opcao porque **nome nao identifica
   * morador**: dois cadastros podem trazer o mesmo nome, e a lista mostrava dois
   * "Ana Silva" sem nada que dissesse qual era qual. A unidade tambem entra na
   * busca, entao digitar o numero dela encontra o morador.
   */
  const residentOptions = useMemo(
    () =>
      residents.map((resident) => ({
        value: resident.id,
        label: resident.name,
        hint: resident.unit ? unitLabel(resident.unit) : undefined,
      })),
    [residents],
  );

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent side="right" dismissible={false} className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar dependente' : 'Novo dependente'}</DialogTitle>
            <DialogDescription>
              Morador titular, dados pessoais, contato e acesso.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Vinculo">
              <Controller
                control={control}
                name="residentId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="residentId"
                    label="Morador"
                    error={fieldState.error?.message}
                    description={
                      missingResident
                        ? 'O morador vinculado não esta mais na lista deste condomínio. Escolha outro.'
                        : 'Apenas moradores do condomínio selecionado.'
                    }
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value}
                        options={residentOptions}
                        placeholder="Selecione o morador"
                        searchPlaceholder="Buscar por nome ou unidade"
                        emptyMessage="Nenhum morador corresponde a busca."
                        onValueChange={(value) => {
                          field.onChange(value);
                          const chosen = residents.find((resident) => resident.id === value);
                          setValue('unitId', chosen?.unitId ?? '', {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />
                    )}
                  </FormField>
                )}
              />

              <FormField
                id="unitId"
                label="Unidade"
                error={errors.unitId?.message}
                description="Definida pelo morador escolhido."
              >
                {/*
                  Somente leitura, e não desabilitado: o valor continua legível
                  e alcancável pelo teclado, que e como quem navega assim
                  confere para onde o dependente esta indo.
                */}
                {(aria) => (
                  <Input
                    {...aria}
                    readOnly
                    value={unit ? unitLabel(unit) : ''}
                    placeholder="Escolha o morador"
                  />
                )}
              </FormField>

              <Controller
                control={control}
                name="relationship"
                render={({ field, fieldState }) => (
                  <FormField id="relationship" label="Parentesco" error={fieldState.error?.message}>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
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
            </FormSection>

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

              {/*
                Coluna `date` no servidor, que devolve e aceita `YYYY-MM-DD`. O
                input nativo fala exatamente esse formato; passar pelo
                `DatePicker` obrigaria a converter para `Date` e voltar, o que
                desloca a data em um dia em fusos negativos.
              */}
              <FormField
                id="birthDate"
                label="Data de nascimento"
                error={errors.birthDate?.message}
              >
                {(aria) => <Input type="date" {...aria} {...register('birthDate')} />}
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

              <FormField id="photoUrl" label="URL da foto" error={errors.photoUrl?.message}>
                {(aria) => <Input {...aria} {...register('photoUrl')} />}
              </FormField>
            </FormSection>

            <FormSection title="Acesso" columns={1}>
              <Controller
                control={control}
                name="hasAccessCard"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasAccessCard"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="hasAccessCard" className="font-normal">
                      Possui cartao de acesso
                    </Label>
                  </div>
                )}
              />

              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="active" className="font-normal">
                      Dependente ativo
                    </Label>
                  </div>
                )}
              />
            </FormSection>

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
        title="Descartar alterações?"
        description="As informações preenchidas serão perdidas."
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
