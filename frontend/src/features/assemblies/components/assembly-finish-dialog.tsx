import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Assembly } from '@/types/assembly';
import { useFinishAssembly } from '../assembly-hooks';
import {
  finishAssemblySchema,
  finishFormDefaults,
  FINISH_FIELDS,
  toFinishPayload,
  type FinishAssemblyFormValues,
} from '../assembly-schema';

export interface AssemblyFinishDialogProps {
  assembly: Assembly;
  onClose: () => void;
}

/**
 * Encerrar a assembleia.
 *
 * E a unica das tres acoes de ciclo que nao e clique unico: `finishAssemblySchema`
 * exige o numero de presentes, e a ata e o registro que a lei cobra. Conferir o
 * schema antes de desenhar o botao e o que separa uma acao de linha de um
 * dialogo — iniciar e cancelar aceitam corpo vazio e continuam na linha.
 *
 * A recusa do servidor aparece aqui dentro, e nao na linha: foi aqui que a acao
 * foi tomada, e `onError` proprio substitui o toast global, que apareceria em
 * duplicidade.
 */
export function AssemblyFinishDialog({ assembly, onClose }: AssemblyFinishDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FinishAssemblyFormValues>({
    resolver: zodResolver(finishAssemblySchema),
    defaultValues: finishFormDefaults(assembly),
  });

  const finish = useFinishAssembly({
    onSuccess: onClose,
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, FINISH_FIELDS),
  });

  const pending = isSubmitting || finish.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    await finish
      .mutateAsync({ id: assembly.id, data: toFinishPayload(values) })
      // A falha ja foi apresentada por `onError`; aqui so nao se deixa a
      // promessa rejeitar sem dono.
      .catch(() => undefined);
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar assembleia</DialogTitle>
          <DialogDescription>
            {assembly.title}. O encerramento registra o comparecimento e, quando houver, o endereco
            da ata.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField
            id="attendeesCount"
            label="Unidades presentes"
            error={errors.attendeesCount?.message}
            description={`O quorum exigido nesta convocacao e de ${assembly.quorumPercent}%.`}
          >
            {(aria) => (
              <Input autoFocus type="number" min={0} {...aria} {...register('attendeesCount')} />
            )}
          </FormField>

          <FormField
            id="minutesUrl"
            label="Ata"
            error={errors.minutesUrl?.message}
            description="Opcional agora: a ata pode ser anexada depois, pela edicao."
          >
            {(aria) => (
              <Input
                inputMode="url"
                placeholder="https://"
                maxLength={255}
                {...aria}
                {...register('minutesUrl')}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Encerrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
