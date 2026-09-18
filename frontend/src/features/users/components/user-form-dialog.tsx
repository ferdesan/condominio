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
import { Checkbox } from '@/components/ui/checkbox';
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
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Condominium, Unit } from '@/types/api';
import type { Role } from '@/types/role';
import type { User } from '@/types/user';
import { unitLabel, userHooks, USERS_KEY } from '../user-hooks';
import {
  toUserFormValues,
  toUserPayload,
  USER_FIELDS,
  userFormDefaults,
  userSchema,
  type UserFormValues,
} from '../user-schema';
import { ALL_CONDOMINIUMS, NO_UNIT, STATUS_LABELS } from '../user-labels';

/** Valor sentinela do "sem vinculo": o Radix nao aceita `SelectItem` vazio. */
const NONE = '__none__';

export interface UserFormDialogProps {
  /** Ausente cadastra; presente edita. */
  user?: User;
  roles: Role[];
  units: Unit[];
  /** Condominios do tenant, do proprio shell: a tela nao faz consulta para isto. */
  condominiums: Condominium[];
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
 * **Sem `CondominiumScopeNotice`.** O aviso existe para o formulario que grava
 * num condominio — ele nomeia a divergencia entre o predio que o dialogo
 * carrega e o que o shell passou a mostrar. Aqui nao ha o que divergir: o
 * usuario pertence ao tenant, e os condominios sao um vinculo escolhido no
 * proprio formulario, nao um escopo herdado da tela.
 *
 * **Sem campo de senha.** Omitida na criacao, o servidor gera uma temporaria e
 * exige a troca no primeiro acesso; depois disso o reset administrativo — que
 * exige `user:manage` — e a unica via. `updateUserSchema` sequer aceita o campo.
 */
export function UserFormDialog({ user, roles, units, condominiums, onClose }: UserFormDialogProps) {
  const isEdit = Boolean(user);
  const queryClient = useQueryClient();

  // "Sem unidade" segue sendo a primeira opção, e não um estado à parte: o
  // vínculo é opcional no servidor e voltar atrás precisa ser tão alcançável
  // quanto escolher. A lista inteira do condomínio cabe no seletor, mas não cabe
  // no olho: sem busca, escolher uma unidade vira rolagem.
  const unitOptions = useMemo(
    () => [
      { value: NONE, label: NO_UNIT },
      ...units.map((unit) => ({ value: unit.id, label: unitLabel(unit) })),
    ],
    [units],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: user ? toUserFormValues(user) : userFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, USER_FIELDS);
  }

  const create = userHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = userHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = toUserPayload(values);
    const request = user ? update.mutateAsync({ id: user.id, data }) : create.mutateAsync(data);
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
            <DialogTitle>{isEdit ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              Quem e a pessoa, o que ela pode fazer e a que predios ela tem acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <FormSection title="Identificação">
              <FormField id="name" label="Nome" error={errors.name?.message}>
                {(aria) => <Input autoFocus maxLength={150} {...aria} {...register('name')} />}
              </FormField>

              <FormField
                id="email"
                label="E-mail"
                error={errors.email?.message}
                description={
                  isEdit
                    ? 'Mudar o e-mail muda por onde a pessoa entra.'
                    : 'O convite e a senha temporária vao para este endereço.'
                }
              >
                {(aria) => <Input type="email" maxLength={180} {...aria} {...register('email')} />}
              </FormField>

              <FormField
                id="phone"
                label="Telefone"
                error={errors.phone?.message}
                description="Opcional."
              >
                {(aria) => <Input maxLength={20} {...aria} {...register('phone')} />}
              </FormField>

              <FormField
                id="document"
                label="CPF"
                error={errors.document?.message}
                description="Opcional. Onze digitos."
              >
                {(aria) => <Input maxLength={14} {...aria} {...register('document')} />}
              </FormField>
            </FormSection>

            <FormSection title="Acesso">
              <Controller
                control={control}
                name="roleId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="roleId"
                    label="Papel"
                    error={fieldState.error?.message}
                    description="Define o que a pessoa pode fazer no sistema."
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
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
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField
                    id="unitId"
                    label="Unidade"
                    error={fieldState.error?.message}
                    description="Apenas para contas de morador."
                  >
                    {(aria) => (
                      <Combobox
                        {...aria}
                        value={field.value === '' ? NONE : field.value}
                        onValueChange={(value) => field.onChange(value === NONE ? '' : value)}
                        options={unitOptions}
                        searchPlaceholder="Buscar unidade"
                        emptyMessage="Nenhuma unidade corresponde à busca."
                      />
                    )}
                  </FormField>
                )}
              />
            </FormSection>

            <Controller
              control={control}
              name="condominiumIds"
              render={({ field, fieldState }) => (
                <FormField
                  id="condominiumIds"
                  label="Condomínios"
                  error={fieldState.error?.message}
                  // Vazio nao e ausencia de acesso: e acesso a tudo. O servidor
                  // le o vinculo ausente como "todos do tenant", e um rotulo que
                  // dissesse "nenhum" inverteria o sentido do registro.
                  description={`Nenhum marcado significa ${ALL_CONDOMINIUMS.toLowerCase()}.`}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    {condominiums.map((condominium) => {
                      const checked = field.value.includes(condominium.id);
                      return (
                        <div key={condominium.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`user-condominium-${condominium.id}`}
                            checked={checked}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true
                                  ? [...field.value, condominium.id]
                                  : field.value.filter((id: string) => id !== condominium.id),
                              )
                            }
                          />
                          <Label
                            htmlFor={`user-condominium-${condominium.id}`}
                            className="font-normal"
                          >
                            {condominium.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
