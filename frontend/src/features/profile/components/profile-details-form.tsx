import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser } from '@/types/api';
import { useUpdateProfile } from '../profile-hooks';
import { THEME_LABELS, roleLabel } from '../profile-labels';
import {
  PROFILE_FIELDS,
  THEMES,
  profileSchema,
  toProfileFormValues,
  toProfilePayload,
  type ProfileFormValues,
} from '../profile-schema';

export interface ProfileDetailsFormProps {
  user: AuthUser;
}

/**
 * Nome, telefone e tema — um unico `PATCH /auth/me`, porque e uma unica rota.
 *
 * **Nao e um dialogo.** O resto do sistema edita sobre a lista (ADR-004) para
 * nao perder filtros e pagina; aqui nao ha lista atras, e o registro editado e
 * sempre o mesmo. Um dialogo sobre uma pagina em branco so acrescentaria um
 * clique.
 *
 * **E-mail, papel e administradora sao leitura.** Nao por decisao de tela: o
 * servidor nao aceita nenhum dos tres em `updateProfileSchema`. Mostra-los como
 * campo desabilitado seria prometer uma edicao que nao existe, entao eles
 * aparecem como texto, com a nota de onde a mudanca realmente acontece.
 */
export function ProfileDetailsForm({ user }: ProfileDetailsFormProps) {
  const { updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    // O tema vem do provedor: e o que esta aplicado nesta tela agora.
    defaultValues: toProfileFormValues(user, theme),
  });

  const update = useUpdateProfile({
    onSuccess: (saved, variables) => {
      // A topbar mostra o nome e a inicial: sem isto continuariam os antigos ate
      // o proximo boot.
      updateUser(saved);
      // Aplicar o tema depois da confirmacao do servidor, e nao antes: uma
      // recusa deixaria a tela num tema que a conta nao guardou.
      const next = variables.preferences.theme;
      if (next) setTheme(next);
      // `reset` com os valores salvos zera o `isDirty` — sem ele o botao
      // continuaria habilitado, sugerindo que algo ficou por gravar.
      reset(toProfileFormValues(saved, next ?? theme));
      toast.success('Perfil atualizado.');
    },
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, PROFILE_FIELDS),
  });

  // `isSubmitting` cobre tambem a validacao, que e assincrona: sem ele, dois
  // cliques seguidos passariam os dois antes de a requisicao sequer comecar.
  const pending = isSubmitting || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // A falha ja foi apresentada por `onError`; aqui so nao se deixa a promessa
    // rejeitar sem dono.
    await update.mutateAsync(toProfilePayload(values)).catch(() => undefined);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados pessoais</CardTitle>
        <CardDescription>
          Como você aparece para as outras pessoas do sistema, e como esta tela se apresenta a você.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="profile-name" label="Nome" error={errors.name?.message}>
              {(aria) => <Input maxLength={150} {...aria} {...register('name')} />}
            </FormField>

            <FormField
              id="profile-phone"
              label="Telefone"
              error={errors.phone?.message}
              description="Opcional."
            >
              {(aria) => <Input maxLength={20} {...aria} {...register('phone')} />}
            </FormField>

            <Controller
              control={control}
              name="theme"
              render={({ field, fieldState }) => (
                <FormField
                  id="profile-theme"
                  label="Tema"
                  error={fieldState.error?.message}
                  description="Aplicado agora e guardado na sua conta, para valer também em outro dispositivo."
                >
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THEMES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {THEME_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />
          </div>

          <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <ReadOnlyField
              label="E-mail"
              value={user.email}
              note="Trocar o endereço de acesso e feito em Usuários, por quem administra a conta."
            />
            <ReadOnlyField
              label="Papel"
              value={roleLabel(user.role)}
              note="Define o que você pode fazer no sistema."
            />
          </dl>

          {formError ? (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end">
            {/* Desabilitado sem alteracao: um PATCH que nao muda nada ainda
                gravaria um registro de auditoria e confundiria a trilha. */}
            <Button type="submit" loading={pending} disabled={!isDirty}>
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReadOnlyField({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-foreground">{label}</dt>
      <dd className="text-sm text-muted-foreground">{value}</dd>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
