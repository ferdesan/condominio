import { useRef, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { INCIDENT_STATUSES, type Incident, type IncidentStatus } from '@/types/incident';
import { INCIDENTS_KEY, useChangeIncidentStatus } from '../incident-hooks';
import {
  CHANGE_STATUS_FIELDS,
  changeStatusSchema,
  DESCRIPTION_MAX_LENGTH,
  toChangeStatusPayload,
  type ChangeStatusFormValues,
} from '../incident-schema';
import { STATUS_LABELS } from '../incident-labels';

/** Status que o servidor so aceita acompanhados de tratativa. */
const FINAL_STATUSES: readonly IncidentStatus[] = ['RESOLVED', 'REJECTED'];

export interface IncidentStatusDialogProps {
  incident: Incident;
  onClose: () => void;
}

/**
 * Mudanca de status.
 *
 * E acao de linha, mas nao e um clique so: ha para onde ir, e resolver ou
 * recusar exige dizer a tratativa. Dai o dialogo.
 *
 * Os destinos oferecidos sao todos os status menos o atual. Quais transicoes
 * valem e do servidor (`STATUS_FLOW`): reproduzir o mapa aqui criaria uma
 * segunda versao dele, que dessincroniza na primeira mudanca do backend. A
 * recusa e um desfecho normal — a ocorrencia pode ter avancado enquanto este
 * dialogo estava aberto — e a mensagem aparece aqui, com o registro como estava
 * e a lista atualizada.
 *
 * O `onError` proprio substitui o toast global do React Query v5, que e o que se
 * quer aqui: a mensagem tem onde aparecer e nao deve aparecer duas vezes.
 */
export function IncidentStatusDialog({ incident, onClose }: IncidentStatusDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const options = INCIDENT_STATUSES.filter((status) => status !== incident.status);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangeStatusFormValues>({
    resolver: zodResolver(changeStatusSchema),
    defaultValues: {
      status: options[0] ?? incident.status,
      resolution: incident.resolution ?? '',
    },
  });

  const status = watch('status');
  const needsResolution = FINAL_STATUSES.includes(status);

  function handleError(error: ApiError): void {
    queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
    applyApiError(error, setError, setFormError, CHANGE_STATUS_FIELDS);
  }

  const changeStatus = useChangeIncidentStatus({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || changeStatus.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // `isPending` so muda no proximo tick, entao dois cliques seguidos passariam
    // os dois. O trinco fecha na hora e garante uma unica chamada.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    await changeStatus
      .mutateAsync({ id: incident.id, data: toChangeStatusPayload(values) })
      // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
      // promessa rejeitar sem dono.
      .catch(() => undefined)
      .finally(() => {
        submittingRef.current = false;
      });
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent side="right" dismissible={false}>
        <DialogHeader>
          <DialogTitle>Mudar status da ocorrencia</DialogTitle>
          <DialogDescription>
            O morador que abriu a ocorrencia e avisado da mudanca.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {incident.protocol} · {incident.title} · agora em{' '}
            <strong>{STATUS_LABELS[incident.status]}</strong>
          </p>

          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <FormField id="status" label="Novo status" error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {STATUS_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />

          <FormField
            id="resolution"
            label="Tratativa"
            error={errors.resolution?.message}
            description={
              needsResolution
                ? 'Obrigatoria para resolver ou recusar: o servidor recusa a mudanca sem ela.'
                : 'Opcional. O que foi feito ate aqui.'
            }
          >
            {(aria) => (
              <Textarea
                rows={4}
                maxLength={DESCRIPTION_MAX_LENGTH}
                {...aria}
                {...register('resolution')}
              />
            )}
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
            {/*
              "Voltar" e nao "Fechar": o botao de fechar do proprio dialogo ja
              usa esse nome, e dois controles com o mesmo nome acessivel no mesmo
              dialogo sao indistinguiveis para quem navega por leitor.
            */}
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Mudar status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
