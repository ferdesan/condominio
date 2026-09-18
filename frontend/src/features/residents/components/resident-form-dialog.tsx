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
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Resident, Unit } from '@/types/api';
import { residentHooks } from '../resident-hooks';
import {
  RESIDENT_FIELDS,
  RESIDENT_FORM_DEFAULTS,
  residentSchema,
  toResidentFormValues,
  toResidentPayload,
  type ResidentFormValues,
} from '../resident-schema';
import { STATUS_LABELS, TYPE_LABELS } from '../resident-labels';

/**
 * Conflito de CPF: o registro existente pode estar removido, e ai o caminho e
 * restaurar, nao cadastrar outro (ADR-006).
 *
 * Os dois motivos de recusa de documento chegam com o mesmo status 409 — digito
 * verificador invalido e CPF ja cadastrado —, entao quem os separa e o codigo.
 * Mensagem invalida nao tem saida alternativa; conflito tem.
 */
const CONFLICT_HINT =
  'Se o morador já existiu e foi removido, restaure o registro em vez de cadastrar outro: ative "Incluir removidos" na listagem.';

export interface ResidentFormDialogProps {
  /** Ausente cadastra; presente edita. */
  resident?: Resident;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Unidades do condominio selecionado — a unica origem valida para o seletor. */
  units: Unit[];
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
export function ResidentFormDialog({
  resident,
  condominiumId,
  units,
  onClose,
}: ResidentFormDialogProps) {
  const isEdit = Boolean(resident);
  const queryClient = useQueryClient();

  // A lista inteira do condomínio cabe no seletor, mas não cabe no olho: sem
  // busca, escolher uma unidade vira rolagem.
  const unitOptions = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: unitLabel(unit) })),
    [units],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictHint, setConflictHint] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ResidentFormValues>({
    resolver: zodResolver(residentSchema),
    defaultValues: resident ? toResidentFormValues(resident) : RESIDENT_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      onClose();
      return;
    }
    setConflictHint(error.code === 'CONFLICT');
    applyApiError(error, setError, setFormError, RESIDENT_FIELDS);
  }

  const create = residentHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = residentHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setConflictHint(false);
    const data = toResidentPayload(values, condominiumId);
    const request = resident
      ? update.mutateAsync({ id: resident.id, data })
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
   * Responsavel inativo e um contato que nao responde. A designacao fica
   * bloqueada enquanto o status nao for ativo, mas o valor guardado permanece:
   * marcar como mudado quem ja era responsavel continua sendo possivel, e quem
   * decide o que fazer com a marca e o servidor.
   */
  const status = watch('status');
  const primaryLocked = status !== 'ACTIVE';

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
            <DialogTitle>{isEdit ? 'Editar morador' : 'Novo morador'}</DialogTitle>
            <DialogDescription>
              Unidade, dados pessoais, contato, período de ocupação e contato de emergência.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Vinculo">
              <Controller
                control={control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="unitId"
                    label="Unidade"
                    error={fieldState.error?.message}
                    description="Apenas unidades do condomínio selecionado."
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value}
                        onValueChange={field.onChange}
                        options={unitOptions}
                        placeholder="Selecione a unidade"
                        searchPlaceholder="Buscar unidade"
                        emptyMessage="Nenhuma unidade corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />

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

              <Controller
                control={control}
                name="isPrimary"
                render={({ field }) => (
                  <div className="space-y-1.5 sm:col-span-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isPrimary"
                        checked={field.value}
                        disabled={primaryLocked}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        aria-describedby={primaryLocked ? 'isPrimary-description' : undefined}
                      />
                      <Label htmlFor="isPrimary" className="font-normal">
                        Responsável principal pela unidade
                      </Label>
                    </div>
                    <p id="isPrimary-description" className="text-sm text-muted-foreground">
                      {primaryLocked
                        ? 'Apenas um morador ativo pode ser o responsável pela unidade.'
                        : 'Ao salvar, qualquer outro responsável desta unidade deixa de se-lo.'}
                    </p>
                  </div>
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

              <FormField
                id="birthDate"
                label="Data de nascimento"
                error={errors.birthDate?.message}
              >
                {(aria) => <Input type="date" {...aria} {...register('birthDate')} />}
              </FormField>

              <FormField
                id="photoUrl"
                label="URL da foto"
                error={errors.photoUrl?.message}
                className="sm:col-span-2"
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

              <FormField
                id="emergencyContact"
                label="Contato de emergência"
                error={errors.emergencyContact?.message}
                className="sm:col-span-2"
              >
                {(aria) => <Input {...aria} {...register('emergencyContact')} />}
              </FormField>

              <Controller
                control={control}
                name="emergencyPhone"
                render={({ field, fieldState }) => (
                  <FormField
                    id="emergencyPhone"
                    label="Telefone de emergência"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <PhoneInput value={field.value} onChange={field.onChange} {...aria} />
                    )}
                  </FormField>
                )}
              />
            </FormSection>

            {/*
              Colunas `date` no servidor, que devolve e aceita `YYYY-MM-DD`. O
              input nativo fala exatamente esse formato; passar pelo `DatePicker`
              obrigaria a converter para `Date` e voltar, o que desloca a data em
              um dia em fusos negativos.
            */}
            <FormSection title="Período de ocupação">
              <FormField id="moveInDate" label="Entrada" error={errors.moveInDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('moveInDate')} />}
              </FormField>

              <FormField id="moveOutDate" label="Saída" error={errors.moveOutDate?.message}>
                {(aria) => <Input type="date" {...aria} {...register('moveOutDate')} />}
              </FormField>
            </FormSection>

            <FormField id="notes" label="Observações" error={errors.notes?.message}>
              {(aria) => <Textarea {...aria} {...register('notes')} />}
            </FormField>

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

/** O bloco desambigua numeros repetidos entre torres; sem ele, some. */
function unitLabel(unit: Unit): string {
  return unit.block?.name ? `${unit.block.name} - ${unit.number}` : unit.number;
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
