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
import type { Resident, Unit, Vehicle } from '@/types/api';
import { vehicleHooks } from '../vehicle-hooks';
import {
  VEHICLE_FIELDS,
  VEHICLE_FORM_DEFAULTS,
  toVehicleFormValues,
  toVehiclePayload,
  vehicleSchema,
  type VehicleFormValues,
} from '../vehicle-schema';
import { STATUS_LABELS, TYPE_LABELS, unitLabel } from '../vehicle-labels';

/**
 * A placa e unica por tenant e a verificacao do servidor alcanca tambem os
 * registros removidos, entao um conflito pode estar apontando para um veiculo
 * que foi excluido — e ai o caminho e restaurar, nao cadastrar outro (ADR-006).
 */
const CONFLICT_HINT =
  'Se o veiculo ja existiu e foi removido, restaure o registro em vez de cadastrar outro: ative "Incluir removidos" na listagem.';

/** Valor sentinela: o Radix nao aceita `SelectItem` com valor vazio. */
const NONE = '__none__';

export interface VehicleFormDialogProps {
  /** Ausente cadastra; presente edita. */
  vehicle?: Vehicle;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  /** Unidades do condominio selecionado — a unica origem valida para o seletor. */
  units: Unit[];
  /** Moradores do condominio selecionado, pelo mesmo motivo. */
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
export function VehicleFormDialog({
  vehicle,
  condominiumId,
  units,
  residents,
  onClose,
}: VehicleFormDialogProps) {
  const isEdit = Boolean(vehicle);
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
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle ? toVehicleFormValues(vehicle) : VEHICLE_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
      return;
    }
    setConflictHint(error.code === 'CONFLICT');
    applyApiError(error, setError, setFormError, VEHICLE_FIELDS);
  }

  const create = vehicleHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = vehicleHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setConflictHint(false);
    const data = toVehiclePayload(values, condominiumId);
    const request = vehicle
      ? update.mutateAsync({ id: vehicle.id, data })
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
        <DialogContent side="right" dismissible={false} className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar veiculo' : 'Novo veiculo'}</DialogTitle>
            <DialogDescription>
              Placa, dados do veiculo, estacionamento e os vinculos — que sao opcionais.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Veiculo">
              <FormField
                id="plate"
                label="Placa"
                error={errors.plate?.message}
                description="Padrao antigo (ABC1234) ou Mercosul (ABC1D23)."
              >
                {(aria) => <Input autoFocus {...aria} {...register('plate')} />}
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

              <FormField id="brand" label="Marca" error={errors.brand?.message}>
                {(aria) => <Input {...aria} {...register('brand')} />}
              </FormField>

              <FormField id="model" label="Modelo" error={errors.model?.message}>
                {(aria) => <Input {...aria} {...register('model')} />}
              </FormField>

              <FormField id="color" label="Cor" error={errors.color?.message}>
                {(aria) => <Input {...aria} {...register('color')} />}
              </FormField>

              <FormField id="year" label="Ano" error={errors.year?.message}>
                {(aria) => (
                  <Input
                    type="number"
                    min={1900}
                    max={2100}
                    inputMode="numeric"
                    {...aria}
                    {...register('year')}
                  />
                )}
              </FormField>
            </FormSection>

            <FormSection title="Estacionamento">
              <FormField id="parkingSpot" label="Vaga" error={errors.parkingSpot?.message}>
                {(aria) => <Input {...aria} {...register('parkingSpot')} />}
              </FormField>

              <FormField
                id="stickerNumber"
                label="Numero do adesivo"
                error={errors.stickerNumber?.message}
              >
                {(aria) => <Input {...aria} {...register('stickerNumber')} />}
              </FormField>
            </FormSection>

            {/*
              Os dois vinculos sao opcionais no servidor e independentes entre
              si: o veiculo de um prestador recorrente, ou o de um morador ainda
              nao cadastrado, existe sem nenhum dos dois. Por isso cada seletor
              abre em "Sem vinculo" e pode voltar para la.
            */}
            <FormSection title="Vinculo">
              <Controller
                control={control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="unitId"
                    label="Unidade"
                    error={fieldState.error?.message}
                    description="Opcional. Apenas unidades do condominio selecionado."
                  >
                    {(aria) => (
                      <Select
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem vinculo</SelectItem>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unitLabel(unit)}
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
                name="residentId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="residentId"
                    label="Morador"
                    error={fieldState.error?.message}
                    description="Opcional. Apenas moradores do condominio selecionado."
                  >
                    {(aria) => (
                      <Select
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                      >
                        <SelectTrigger {...aria}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem vinculo</SelectItem>
                          {residents.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
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
