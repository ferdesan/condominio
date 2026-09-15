import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { useAuth } from '@/hooks/use-auth';
import { useChangePassword } from '../profile-hooks';
import {
  PASSWORD_FIELDS,
  passwordFormDefaults,
  passwordSchema,
  toPasswordPayload,
  type PasswordFormValues,
} from '../profile-schema';

/**
 * Troca da propria senha, sob confirmacao.
 *
 * **A troca derruba a sessao.** `authService.changePassword` chama
 * `revokeAllForUser` antes de responder: todos os refresh tokens do usuario sao
 * revogados, inclusive o deste navegador. Nao ha como preservar a sessao atual —
 * o servidor nao distingue a de quem pediu. Por isso a acao pede confirmacao e
 * termina em `logout()`: continuar na tela com um token que so sobrevive ate
 * expirar daria a impressao de uma sessao viva que nao existe mais.
 *
 * **401 aqui e erro de campo.** Em qualquer outra rota autenticada o 401
 * significa sessao encerrada, e o interceptor do axios trata assim; aqui ele
 * significa "senha atual incorreta". A mensagem e apontada ao campo que a
 * provocou em vez de virar um aviso geral.
 */
export function PasswordForm() {
  const { logout } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: passwordFormDefaults(),
  });

  const change = useChangePassword({
    onSuccess: () => {
      toast.success('Senha alterada. Entre novamente com a nova senha.');
      // Nao ha `navigate`: limpar a sessao faz o `ProtectedRoute` levar ao login
      // por conta propria, e sem competir com a animacao de rota do shell.
      void logout();
    },
    onError: (error: ApiError) => {
      setConfirmOpen(false);
      if (error.status === 401) {
        setError('currentPassword', { message: error.message || 'Senha atual incorreta.' });
        setFormError(null);
        return;
      }
      applyApiError(error, setError, setFormError, PASSWORD_FIELDS);
    },
  });

  const pending = isSubmitting || change.isPending;

  // Valida primeiro, confirma depois: pedir confirmacao de um formulario invalido
  // faria a pessoa decidir sobre uma acao que nem chegaria ao servidor.
  const onSubmit = handleSubmit(() => {
    setFormError(null);
    setConfirmOpen(true);
  });

  const submitConfirmed = handleSubmit(async (values) => {
    await change.mutateAsync(toPasswordPayload(values)).catch(() => undefined);
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
          <CardDescription>
            Trocar a senha encerra sua sessao em todos os dispositivos, inclusive neste.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="current-password"
                label="Senha atual"
                error={errors.currentPassword?.message}
                className="sm:col-span-2"
              >
                {(aria) => (
                  <div className="relative">
                    <Input
                      type={visible ? 'text' : 'password'}
                      autoComplete="current-password"
                      maxLength={72}
                      className="pr-10"
                      {...aria}
                      {...register('currentPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((previous) => !previous)}
                      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                    >
                      {visible ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </FormField>

              <FormField
                id="new-password"
                label="Nova senha"
                error={errors.newPassword?.message}
                description="Ao menos 8 caracteres, com maiuscula, minuscula e numero."
              >
                {(aria) => (
                  <Input
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={72}
                    {...aria}
                    {...register('newPassword')}
                  />
                )}
              </FormField>

              <FormField
                id="confirm-password"
                label="Repetir a nova senha"
                error={errors.confirmPassword?.message}
              >
                {(aria) => (
                  <Input
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={72}
                    {...aria}
                    {...register('confirmPassword')}
                  />
                )}
              </FormField>
            </div>

            {formError ? (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" loading={pending}>
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Alterar a senha e sair?"
        description="Voce sera desconectado aqui e em qualquer outro dispositivo, e precisara entrar de novo com a nova senha."
        actionLabel="Alterar e sair"
        cancelLabel="Cancelar"
        variant="warning"
        loading={pending}
        onConfirm={() => void submitConfirmed()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
