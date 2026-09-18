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
import { Combobox } from '@/components/ui/combobox';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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
import type { Maintenance } from '@/types/maintenance';
import type { User } from '@/types/user';
import { maintenanceHooks, MAINTENANCES_KEY } from '../maintenance-hooks';
import {
  DESCRIPTION_MAX_LENGTH,
  MAINTENANCE_FIELDS,
  maintenanceFormDefaults,
  maintenanceSchema,
  toMaintenanceFormValues,
  toMaintenancePayload,
  type MaintenanceFormValues,
} from '../maintenance-schema';
import { NO_PROVIDER, NO_RESPONSIBLE, RECURRENCE_LABELS, TYPE_LABELS } from '../maintenance-labels';

/** Valor sentinela do "sem vinculo": o Radix nao aceita `SelectItem` vazio. */
const NONE = '__none__';

export interface MaintenanceFormDialogProps {
  /** Ausente cadastra; presente edita. */
  maintenance?: Maintenance;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Ja escopados ao condominio pelo proprio servidor. */
  providers: ServiceProvider[];
  /** Ja recortados para o condominio selecionado por `scopeToCondominium`. */
  responsibles: User[];
  onClose: () => void;
}

/**
 * Cadastro e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 *
 * `status` nao e campo: quem o move sao as tres acoes de linha, que verificam a
 * transicao e registram `startedAt` / `completedAt` — e, quando a ordem e
 * recorrente, ja abrem a proxima.
 */
export function MaintenanceFormDialog({
  maintenance,
  condominiumId,
  providers,
  responsibles,
  onClose,
}: MaintenanceFormDialogProps) {
  const isEdit = Boolean(maintenance);
  const queryClient = useQueryClient();

  // "Sem prestador" e "Sem responsável" seguem sendo a primeira opção, e não um
  // estado à parte: os dois vínculos são opcionais no servidor e voltar atrás
  // precisa ser tão alcançável quanto escolher.
  //
  // A razão social vai como dica do prestador, e o e-mail como dica do
  // responsável: nome fantasia e nome de pessoa não identificam sozinhos, e as
  // duas dicas também entram na busca.
  const providerOptions = useMemo(
    () => [
      { value: NONE, label: NO_PROVIDER },
      ...providers.map((provider) => ({
        value: provider.id,
        label: provider.tradeName ?? provider.companyName,
        hint: provider.tradeName ? provider.companyName : undefined,
      })),
    ],
    [providers],
  );

  const responsibleOptions = useMemo(
    () => [
      { value: NONE, label: NO_RESPONSIBLE },
      ...responsibles.map((user) => ({ value: user.id, label: user.name, hint: user.email })),
    ],
    [responsibles],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: maintenance ? toMaintenanceFormValues(maintenance) : maintenanceFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [MAINTENANCES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, MAINTENANCE_FIELDS);
  }

  const create = maintenanceHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = maintenanceHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toMaintenancePayload(values, condominiumId);
    const request = maintenance
      ? update.mutateAsync({ id: maintenance.id, data })
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
        <DialogContent side="right" dismissible={false} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
            <DialogDescription>
              O que será feito, em que ativo, quando e por quem.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Ordem" columns={1}>
              <FormField id="title" label="Título" error={errors.title?.message}>
                {(aria) => <Input autoFocus maxLength={180} {...aria} {...register('title')} />}
              </FormField>

              <FormField
                id="description"
                label="Descrição"
                error={errors.description?.message}
                description="Opcional. O serviço a executar, com o detalhe que o prestador precisa."
              >
                {(aria) => (
                  // O teto do servidor e 5000; o `Textarea` traz 2000 por padrao
                  // e cortaria o texto antes do envio, sem acusar nada.
                  <Textarea
                    rows={5}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    {...aria}
                    {...register('description')}
                  />
                )}
              </FormField>
            </FormSection>

            {/* A secao nao repete o nome do campo "Agendamento": um `legend` com o
                mesmo texto de um rotulo deixa duas coisas com o mesmo nome no
                mesmo dialogo. */}
            <FormSection title="Programação">
              <FormField
                id="assetName"
                label="Ativo"
                error={errors.assetName?.message}
                description="Opcional. Ex.: Elevador Social - Torre A."
              >
                {(aria) => <Input maxLength={150} {...aria} {...register('assetName')} />}
              </FormField>

              <Controller
                control={control}
                name="scheduledFor"
                render={({ field, fieldState }) => (
                  <FormField
                    id="scheduledFor"
                    label="Agendamento"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <DateTimeInput {...aria} value={field.value} onChange={field.onChange} />
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
                name="recurrence"
                render={({ field, fieldState }) => (
                  <FormField
                    id="recurrence"
                    label="Recorrência"
                    error={fieldState.error?.message}
                    className="sm:col-span-3"
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
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

            {/*
              Os dois vinculos sao do condomínio: o prestador porque o próprio
              servidor escopa `/service-providers`, e o responsavel porque a tela
              recorta `/users`, que e por tenant. Sao tambem o que o servico
              confere em `assertReferences` antes de gravar.
            */}
            <FormSection title="Responsabilidade" columns={2}>
              <Controller
                control={control}
                name="serviceProviderId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="serviceProviderId"
                    label="Prestador"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                        options={providerOptions}
                        searchPlaceholder="Buscar prestador"
                        emptyMessage="Nenhum prestador corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />

              <Controller
                control={control}
                name="responsibleId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="responsibleId"
                    label="Responsável"
                    error={fieldState.error?.message}
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                        options={responsibleOptions}
                        searchPlaceholder="Buscar por nome ou e-mail"
                        emptyMessage="Nenhum usuário corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />
            </FormSection>

            {formError ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {formError}
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
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  const grid =
    columns === 1
      ? 'grid gap-4'
      : columns === 2
        ? 'grid gap-4 sm:grid-cols-2'
        : 'grid gap-4 sm:grid-cols-3';
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">{title}</legend>
      <div className={grid}>{children}</div>
    </fieldset>
  );
}
