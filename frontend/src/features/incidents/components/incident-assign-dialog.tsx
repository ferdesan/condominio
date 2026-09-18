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
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Incident, IncidentAssignee } from '@/types/incident';
import { INCIDENTS_KEY, useAssignIncident } from '../incident-hooks';
import {
  ASSIGN_FIELDS,
  assignSchema,
  toAssignPayload,
  type AssignFormValues,
} from '../incident-schema';
import { STATUS_LABELS } from '../incident-labels';

export interface IncidentAssignDialogProps {
  incident: Incident;
  /** Ja recortados para o condominio selecionado por `scopeAssignees`. */
  assignees: IncidentAssignee[];
  onClose: () => void;
}

/**
 * Atribuicao de responsavel. Exige **`incident:manage`** (ADR-002).
 *
 * O seletor so oferece gente do condominio selecionado. O recorte e do cliente
 * porque `/users` e por tenant e nao aceita `condominiumId` como filtro — mandar
 * a chave nao faria nada e o seletor pareceria escopado sem estar.
 *
 * A recusa do servidor e um desfecho normal: o usuario escolhido pode ter sido
 * removido enquanto este dialogo estava aberto. A mensagem aparece aqui, e a
 * lista e atualizada.
 */
export function IncidentAssignDialog({ incident, assignees, onClose }: IncidentAssignDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { assignedToId: incident.assignedToId ?? '' },
  });

  function handleError(error: ApiError): void {
    queryClient.invalidateQueries({ queryKey: [INCIDENTS_KEY] });
    applyApiError(error, setError, setFormError, ASSIGN_FIELDS);
  }

  const assign = useAssignIncident({ onSuccess: onClose, onError: handleError });
  const pending = isSubmitting || assign.isPending;

  const onSubmit = handleSubmit(async (values) => {
    // `isPending` so muda no proximo tick, entao dois cliques seguidos passariam
    // os dois. O trinco fecha na hora e garante uma unica chamada.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    await assign
      .mutateAsync({ id: incident.id, data: toAssignPayload(values) })
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
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogDescription>
            Quem for escolhido e avisado. Uma ocorrência aberta passa a estar em analise.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {incident.protocol} · {incident.title} · agora em{' '}
            <strong>{STATUS_LABELS[incident.status]}</strong>
          </p>

          <Controller
            control={control}
            name="assignedToId"
            render={({ field, fieldState }) => (
              <FormField
                id="assignedToId"
                label="Responsável"
                error={fieldState.error?.message}
                description="Apenas usuários ativos com acesso ao condomínio selecionado."
              >
                {(aria) =>
                  assignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum usuário ativo com acesso a este condomínio.
                    </p>
                  ) : (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignees.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }
              </FormField>
            )}
          />

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
              usa esse nome, e dois controles com o mesmo nome acessível no mesmo
              dialogo sao indistinguíveis para quem navega por leitor.
            */}
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Atribuir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
