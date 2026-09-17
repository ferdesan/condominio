import { useCallback, useRef, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { CondominiumScopeNotice } from '@/components/common/condominium-scope-notice';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { formatCurrency } from '@/lib/format';
import type { CommonArea, Unit } from '@/types/api';
import { reservationHooks, RESERVATIONS_KEY } from '../reservation-hooks';
import {
  buildReservationSchema,
  describeAreaRules,
  RESERVATION_FIELDS,
  RESERVATION_FORM_DEFAULTS,
  toReservationPayload,
  type ReservationFormValues,
} from '../reservation-rules';

export interface ReservationFormDialogProps {
  condominiumId: string;
  /** Apenas areas reservaveis; as indisponiveis nao chegam aqui. */
  areas: CommonArea[];
  units: Unit[];
  onClose: () => void;
}

/**
 * Formulario de reserva (ADR-004: sobre a lista, para que filtros e pagina
 * sobrevivam a acao).
 *
 * As restricoes da area escolhida aparecem antes do envio, e as oito regras
 * decidiveis a partir dela sao conferidas localmente (ADR-011). Sobreposicao e
 * intervalo minimo ficam com o servidor: um envio localmente valido pode ser
 * recusado, e isso e um desfecho normal.
 */
export function ReservationFormDialog({
  condominiumId,
  areas,
  units,
  onClose,
}: ReservationFormDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  /**
   * A area escolhida fica tambem numa ref porque e o resolver quem a le. Um
   * resolver estavel que consulta a ref re-deriva as regras a cada validacao,
   * sem depender de o react-hook-form aceitar um resolver novo a cada render.
   */
  const [areaId, setAreaId] = useState('');
  const selectedArea = areas.find((area) => area.id === areaId) ?? null;
  const areaRef = useRef<CommonArea | null>(selectedArea);
  areaRef.current = selectedArea;

  const resolver = useCallback<Resolver<ReservationFormValues>>(
    (values, context, options) =>
      zodResolver(buildReservationSchema(areaRef.current))(values, context, options),
    [],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReservationFormValues>({
    resolver,
    defaultValues: RESERVATION_FORM_DEFAULTS,
  });

  function handleError(error: ApiError): void {
    // 422 traz o campo e vira erro dele; 409 nao traz nenhum e vira mensagem do
    // formulario. Quem separa os dois e a presenca do detalhe, nao o status.
    applyApiError(error, setError, setFormError, RESERVATION_FIELDS);
  }

  const create = reservationHooks.useCreate({
    onSuccess: () => {
      // O calendario le outro endpoint, entao a invalidacao do recurso inteiro e
      // o que faz a reserva nova aparecer nas duas visoes.
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
      onClose();
    },
    onError: handleError,
  });

  const pending = isSubmitting || create.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // Dois cliques seguidos chegariam antes de `isPending` mudar.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    await create
      .mutateAsync(toReservationPayload(values, condominiumId))
      .catch(() => undefined)
      .finally(() => {
        submittingRef.current = false;
      });
  });

  if (areas.length === 0) {
    return (
      <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent side="right" dismissible={false}>
          <DialogHeader>
            <DialogTitle>Nova reserva</DialogTitle>
            <DialogDescription>
              Este condominio ainda nao tem areas comuns disponiveis para reserva. Cadastre uma area
              comum antes de registrar reservas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}>
      <DialogContent side="right" dismissible={false} className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova reserva</DialogTitle>
          <DialogDescription>
            Area comum, unidade e periodo. As regras da area escolhida aparecem abaixo dela.
          </DialogDescription>
        </DialogHeader>

        <CondominiumScopeNotice condominiumId={condominiumId} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Controller
            control={control}
            name="commonAreaId"
            render={({ field, fieldState }) => (
              <FormField id="commonAreaId" label="Area comum" error={fieldState.error?.message}>
                {(aria) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Trocar a area re-deriva as regras: o que valia para a
                      // anterior precisa ser reavaliado.
                      setAreaId(value);
                    }}
                  >
                    <SelectTrigger {...aria}>
                      <SelectValue placeholder="Selecione a area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />

          {selectedArea ? (
            <section
              aria-label="Regras da area"
              className="rounded-md border border-border bg-muted/40 p-3 text-sm"
            >
              <p className="mb-2 flex items-center gap-2 font-medium">
                <Info className="size-4" aria-hidden="true" />
                Regras de {selectedArea.name}
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {describeAreaRules(selectedArea).map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              {selectedArea.reservationFee > 0 ? (
                <p className="mt-2 text-muted-foreground">
                  Taxa de reserva: {formatCurrency(selectedArea.reservationFee)}.
                </p>
              ) : null}
            </section>
          ) : null}

          <Controller
            control={control}
            name="unitId"
            render={({ field, fieldState }) => (
              <FormField id="unitId" label="Unidade" error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          Unidade {unit.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="startsAt"
              render={({ field, fieldState }) => (
                <FormField id="startsAt" label="Inicio" error={fieldState.error?.message}>
                  {(aria) => (
                    <DateTimeInput value={field.value} onChange={field.onChange} {...aria} />
                  )}
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="endsAt"
              render={({ field, fieldState }) => (
                <FormField id="endsAt" label="Termino" error={fieldState.error?.message}>
                  {(aria) => (
                    <DateTimeInput value={field.value} onChange={field.onChange} {...aria} />
                  )}
                </FormField>
              )}
            />
          </div>

          <FormField
            id="guestsCount"
            label="Convidados"
            error={errors.guestsCount?.message}
            description={
              selectedArea && selectedArea.capacity > 0
                ? `Capacidade de ${selectedArea.capacity} pessoas.`
                : undefined
            }
          >
            {(aria) => <Input inputMode="numeric" {...aria} {...register('guestsCount')} />}
          </FormField>

          <FormField id="notes" label="Observacoes" error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} {...register('notes')} />}
          </FormField>

          {formError ? (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Reservar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
