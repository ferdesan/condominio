import { useState } from 'react';
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
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import type { Role } from '@/types/role';
import { roleHooks, ROLES_KEY, usePermissionCatalog } from '../role-hooks';
import { NAME_UPPERCASED, SYSTEM_ROLE_LOCKED } from '../role-labels';
import {
  ROLE_FIELDS,
  WILDCARD,
  roleFormDefaults,
  roleSchema,
  splitCatalog,
  toRoleFormValues,
  toRolePayload,
  toSystemRolePayload,
  type RoleFormValues,
} from '../role-schema';
import { PermissionMatrix } from './permission-matrix';

export interface RoleFormDialogProps {
  /** Ausente cadastra; presente edita. */
  role?: Role;
  /**
   * Se quem edita pode conceder o curinga `*`.
   *
   * `roleService.assertPermissions` recusa a concessao a quem nao e super-admin,
   * e `isSuperAdmin` no servidor e exatamente `roleName === 'SUPER_ADMIN'` —
   * entao o cliente consegue espelhar a regra, e nao apenas adivinha-la.
   */
  canGrantWildcard: boolean;
  onClose: () => void;
}

/**
 * Cadastro e edicao acontecem sobre a lista para que filtros, busca e pagina
 * sobrevivam a acao (ADR-004).
 *
 * Monte este componente apenas enquanto o dialogo deve estar aberto, com `key`
 * no id do registro: os valores iniciais entram uma vez e nenhum refetch da
 * lista sobrescreve o que o usuario ja marcou.
 *
 * **Papel do sistema abre com quase tudo travado.**
 * `roleService.beforeUpdate` recusa renomear e recusa alterar permissoes de um
 * papel semeado — as duas com 409. Sobra a descricao. O formulario reflete isso
 * em vez de deixar a pessoa preencher uma tela inteira para receber a recusa
 * depois, e o corpo enviado nesse caso tem **um campo so**: a guarda do servidor
 * olha a *presenca* da chave `permissions`, e nao o conteudo, entao reenviar as
 * mesmas permissoes seria recusado.
 *
 * **Sem `CondominiumScopeNotice`.** O aviso existe para formulario que grava num
 * condominio; papel pertence ao tenant, e nao ha escopo herdado do shell que
 * possa divergir.
 */
export function RoleFormDialog({ role, canGrantWildcard, onClose }: RoleFormDialogProps) {
  const isEdit = Boolean(role);
  const isSystem = role?.isSystem ?? false;
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const catalogQuery = usePermissionCatalog();
  const catalog = catalogQuery.data ?? [];
  const { hasWildcard } = splitCatalog(catalog);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: role ? toRoleFormValues(role) : roleFormDefaults(),
  });

  function handleError(error: ApiError): void {
    // O registro sumiu enquanto o dialogo estava aberto: insistir no formulario
    // nao leva a lugar nenhum, entao fechamos e deixamos a lista contar o que ha.
    if (error.status === 404) {
      queryClient.invalidateQueries({ queryKey: [ROLES_KEY] });
      onClose();
      return;
    }
    applyApiError(error, setError, setFormError, ROLE_FIELDS);
  }

  const create = roleHooks.useCreate({ onSuccess: onClose, onError: handleError });
  const update = roleHooks.useUpdate({ onSuccess: onClose, onError: handleError });
  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const request = role
      ? update.mutateAsync({
          id: role.id,
          data: isSystem ? toSystemRolePayload(values) : toRolePayload(values),
        })
      : create.mutateAsync(toRolePayload(values));
    // A falha ja foi apresentada por `handleError`; aqui so nao se deixa a
    // promessa rejeitar sem dono.
    await request.catch(() => undefined);
  });

  /** Descartar o que foi marcado precisa ser uma escolha, nao um clique fora. */
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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar papel' : 'Novo papel'}</DialogTitle>
            <DialogDescription>
              {isSystem
                ? SYSTEM_ROLE_LOCKED
                : 'O nome identifica o papel; as permissoes definem o que quem o tem pode fazer.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="role-name"
                label="Nome"
                error={errors.name?.message}
                description={isSystem ? 'Papel do sistema: o nome e fixo.' : NAME_UPPERCASED}
              >
                {(aria) => (
                  <Input
                    autoFocus={!isSystem}
                    maxLength={60}
                    disabled={isSystem}
                    {...aria}
                    {...register('name')}
                  />
                )}
              </FormField>

              <FormField
                id="role-description"
                label="Descricao"
                error={errors.description?.message}
                description="Opcional. Para que serve este papel."
              >
                {(aria) => (
                  <Textarea rows={2} maxLength={255} {...aria} {...register('description')} />
                )}
              </FormField>
            </div>

            <Controller
              control={control}
              name="permissions"
              render={({ field, fieldState }) => (
                <fieldset disabled={isSystem} className="space-y-3">
                  <legend className="text-sm font-semibold text-foreground">Permissoes</legend>

                  {fieldState.error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {fieldState.error.message}
                    </p>
                  ) : null}

                  {catalogQuery.isPending ? (
                    <Skeleton className="h-64 w-full" />
                  ) : catalogQuery.isError ? (
                    // Sem catalogo nao ha o que oferecer: inventar a lista aqui
                    // divergiria do servidor em silencio.
                    <p role="alert" className="text-sm text-destructive">
                      Nao foi possivel carregar o catalogo de permissoes.{' '}
                      {catalogQuery.error.message}
                    </p>
                  ) : (
                    <>
                      {/*
                        O curinga fica fora da matriz — ele nao tem recurso nem
                        acao — e so aparece para quem pode concede-lo. Oferece-lo
                        a um administrador comum seria oferecer uma recusa.
                      */}
                      {hasWildcard && canGrantWildcard ? (
                        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                          <Checkbox
                            id="role-wildcard"
                            checked={field.value.includes(WILDCARD)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true
                                  ? [WILDCARD, ...field.value.filter((item) => item !== WILDCARD)]
                                  : field.value.filter((item) => item !== WILDCARD),
                              )
                            }
                          />
                          <div className="space-y-0.5">
                            <Label htmlFor="role-wildcard" className="font-normal">
                              Acesso total (*)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Libera tudo, inclusive o que for acrescentado ao sistema depois.
                              Exclusivo de operadores da plataforma.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <PermissionMatrix
                        idPrefix="role-form"
                        catalog={catalog}
                        value={field.value}
                        // Somente leitura em papel do sistema: o `fieldset`
                        // acima ja desabilita, e sem `onChange` a matriz nao
                        // promete interacao.
                        {...(isSystem ? {} : { onChange: field.onChange })}
                      />
                    </>
                  )}
                </fieldset>
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
