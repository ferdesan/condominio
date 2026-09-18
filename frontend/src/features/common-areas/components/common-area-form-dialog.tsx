import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { CommonArea } from '@/types/api';
import { commonAreaHooks } from '../common-area-hooks';
import {
  COMMON_AREA_FIELDS,
  COMMON_AREA_FORM_DEFAULTS,
  COMMON_AREA_STATUS_LABELS,
  commonAreaSchema,
  toCommonAreaFormValues,
  toCommonAreaPayload,
  type CommonAreaFormValues,
} from '../common-area-schema';
import { WeekdayPicker } from './weekday-picker';

export interface CommonAreaFormDialogProps {
  /** Ausente cadastra; presente edita. */
  area?: CommonArea;
  /** Condominio do shell: o corpo da requisicao o exige e o formulario nao o pergunta. */
  condominiumId: string;
  onClose: () => void;
}

/**
 * Cadastro e edicao de area comum, sobre a lista, para que filtros, busca e
 * pagina sobrevivam a acao (ADR-004).
 *
 * Sao dezesseis campos, entao vao agrupados — identificacao, disponibilidade,
 * regras de reserva e custo — e nao numa lista corrida. A largura maior segue o
 * que Condominios ja fez: o dialogo e o unico lugar de edicao, e um formulario
 * deste tamanho nao cabe na largura padrao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja digitou.
 */
export function CommonAreaFormDialog({ area, condominiumId, onClose }: CommonAreaFormDialogProps) {
  const isEdit = Boolean(area);
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const submittingRef = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CommonAreaFormValues>({
    resolver: zodResolver(commonAreaSchema),
    defaultValues: area ? toCommonAreaFormValues(area) : COMMON_AREA_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: ['common-areas'] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, COMMON_AREA_FIELDS);
  }

  const create = commonAreaHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = commonAreaHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // O `isPending` da mutacao so muda no proximo tick; o trinco fecha na hora.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    const data = toCommonAreaPayload(values, condominiumId);
    const request = area ? update.mutateAsync({ id: area.id, data }) : create.mutateAsync(data);
    // A falha ja foi apresentada por `handleError`.
    await request.catch(() => undefined);
    submittingRef.current = false;
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
            <DialogTitle>{isEdit ? 'Editar área comum' : 'Nova área comum'}</DialogTitle>
            <DialogDescription>
              Identificação, disponibilidade, regras de reserva e custo da área.
            </DialogDescription>
          </DialogHeader>

          <CondominiumScopeNotice condominiumId={condominiumId} />

          {/*
            Editar estes parametros muda o que o formulário de reservas aceita:
            ele deriva as nove regras do registro da área em tempo de execução
            (ADR-011). Quem edita precisa saber que nao esta so descrevendo a
            área — esta mudando o que será possível reservar.
          */}
          {isEdit ? (
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                As regras de reserva abaixo valem imediatamente para o formulário de Reservas:
                horário, dias, duração, antecedência e intervalo passam a ser cobrados com os
                valores salvos aqui.
              </span>
            </p>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Identificação</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="common-area-name" label="Nome" error={errors.name?.message}>
                  {(aria) => <Input autoFocus {...aria} {...register('name')} />}
                </FormField>

                <Controller
                  control={control}
                  name="status"
                  render={({ field, fieldState }) => (
                    <FormField
                      id="common-area-status"
                      label="Status"
                      error={fieldState.error?.message}
                    >
                      {(aria) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger {...aria}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(COMMON_AREA_STATUS_LABELS).map(([value, label]) => (
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
                  id="common-area-capacity"
                  label="Capacidade"
                  error={errors.capacity?.message}
                  description="Número de pessoas. Zero não impoe limite."
                >
                  {(aria) => <Input inputMode="numeric" {...aria} {...register('capacity')} />}
                </FormField>

                <FormField
                  id="common-area-photo-url"
                  label="Foto (URL)"
                  error={errors.photoUrl?.message}
                >
                  {(aria) => <Input {...aria} {...register('photoUrl')} />}
                </FormField>
              </div>

              <FormField
                id="common-area-description"
                label="Descrição"
                error={errors.description?.message}
              >
                {(aria) => (
                  <Textarea maxLength={2000} rows={2} {...aria} {...register('description')} />
                )}
              </FormField>
            </section>

            <section className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Disponibilidade</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  id="common-area-opens-at"
                  label="Abre as"
                  error={errors.opensAt?.message}
                >
                  {(aria) => <Input type="time" {...aria} {...register('opensAt')} />}
                </FormField>

                <FormField
                  id="common-area-closes-at"
                  label="Fecha as"
                  error={errors.closesAt?.message}
                >
                  {(aria) => <Input type="time" {...aria} {...register('closesAt')} />}
                </FormField>
              </div>

              <Controller
                control={control}
                name="allWeekdays"
                render={({ field: allField }) => (
                  <Controller
                    control={control}
                    name="weekdays"
                    render={({ field: daysField }) => (
                      <WeekdayPicker
                        allWeekdays={allField.value}
                        onAllWeekdaysChange={allField.onChange}
                        weekdays={daysField.value}
                        onWeekdaysChange={daysField.onChange}
                      />
                    )}
                  />
                )}
              />
            </section>

            <section className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Regras de reserva</h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  id="common-area-min-hours"
                  label="Duração mínima (h)"
                  error={errors.minHours?.message}
                >
                  {(aria) => <Input inputMode="numeric" {...aria} {...register('minHours')} />}
                </FormField>

                <FormField
                  id="common-area-max-hours"
                  label="Duração máxima (h)"
                  error={errors.maxHours?.message}
                >
                  {(aria) => <Input inputMode="numeric" {...aria} {...register('maxHours')} />}
                </FormField>

                <FormField
                  id="common-area-advance-booking-days"
                  label="Antecedência (dias)"
                  error={errors.advanceBookingDays?.message}
                  description="Até quantos dias no futuro se pode reservar."
                >
                  {(aria) => (
                    <Input inputMode="numeric" {...aria} {...register('advanceBookingDays')} />
                  )}
                </FormField>

                <FormField
                  id="common-area-min-interval-days"
                  label="Intervalo mínimo (dias)"
                  error={errors.minIntervalDays?.message}
                  description="Entre reservas da mesma unidade."
                >
                  {(aria) => (
                    <Input inputMode="numeric" {...aria} {...register('minIntervalDays')} />
                  )}
                </FormField>
              </div>

              <Controller
                control={control}
                name="requiresApproval"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="common-area-requires-approval"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="common-area-requires-approval" className="font-normal">
                      Exige aprovação do síndico
                    </Label>
                  </div>
                )}
              />

              <FormField id="common-area-rules" label="Regras de uso" error={errors.rules?.message}>
                {(aria) => <Textarea maxLength={5000} rows={3} {...aria} {...register('rules')} />}
              </FormField>
            </section>

            <section className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Custo</h3>

              <Controller
                control={control}
                name="reservationFee"
                render={({ field, fieldState }) => (
                  <FormField
                    id="common-area-reservation-fee"
                    label="Taxa de reserva"
                    error={fieldState.error?.message}
                    className="sm:max-w-xs"
                  >
                    {(aria) => (
                      <CurrencyInput {...aria} value={field.value} onChange={field.onChange} />
                    )}
                  </FormField>
                )}
              />
            </section>

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
                {isEdit ? 'Salvar área' : 'Criar área'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        title="Descartar alterações?"
        description="O que foi preenchido neste formulário será perdido."
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>
  );
}
