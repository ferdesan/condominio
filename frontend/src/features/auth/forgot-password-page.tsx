import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { AuthShell } from './components/auth-shell';
import { useForgotPassword } from './auth-hooks';
import { FORGOT_FIELDS, forgotPasswordSchema, type ForgotPasswordValues } from './auth-schema';

/**
 * Pedido de link de recuperacao.
 *
 * **Publica**, fora do `ProtectedRoute`: quem precisa dela e justamente quem nao
 * consegue entrar. E **nao redireciona quem ja tem sessao** — nao ha guarda de
 * anonimato neste roteador, o login a implementa por dentro, e duplicar a
 * logica aqui acrescentaria um ramo para um caso inofensivo.
 *
 * **A tela responde igual exista ou nao a conta.** `authService.forgotPassword`
 * sempre devolve 202, sem sinalizar se encontrou o e-mail — e a protecao contra
 * enumeracao de contas. Variar a mensagem, o estado ou o caminho conforme a
 * resposta desfaria no cliente o que o servidor protege. Por isso o sucesso
 * leva a **um** estado, e a frase fala em condicional: "se o e-mail estiver
 * cadastrado".
 *
 * **O `token` da resposta nao e lido.** O servidor o devolve fora de producao
 * para facilitar a integracao local; uma tela que o usasse — para pular direto
 * para a redefinicao, por exemplo — funcionaria na maquina de quem escreveu e
 * quebraria no deploy.
 */
export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const request = useForgotPassword({
    onSuccess: ({ email }) => setSentTo(email),
    // O unico erro possivel aqui e de transporte ou o limite de tentativas: o
    // servidor nao recusa e-mail desconhecido.
    onError: (error: ApiError) => applyApiError(error, setError, setFormError, FORGOT_FIELDS),
  });

  const pending = isSubmitting || request.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // A falha ja foi apresentada por `onError`; aqui so nao se deixa a promessa
    // rejeitar sem dono.
    await request.mutateAsync({ email: values.email.trim() }).catch(() => undefined);
  });

  if (sentTo) {
    return (
      <AuthShell subtitle="Recuperação de acesso">
        <div className="app-surface space-y-4 p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Verifique seu e-mail</h2>
            {/*
              Condicional de proposito: afirmar que o e-mail foi enviado
              confirmaria que a conta existe. O endereço aparece porque foi o
              que a pessoa digitou — e util para perceber um erro de digitação —
              e não porque o servidor o reconheceu.
            */}
            <p className="text-sm text-muted-foreground">
              Se <span className="font-medium text-foreground">{sentTo}</span> estiver cadastrado,
              enviamos as instruções para redefinir a senha. O link vale por tempo limitado.
            </p>
          </div>

          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link to="/login">Voltar para o login</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setSentTo(null)}
            >
              Usar outro e-mail
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Recuperação de acesso">
      <form onSubmit={onSubmit} noValidate className="app-surface space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Esqueci minha senha</h2>
          <p className="text-sm text-muted-foreground">
            Informe o e-mail da sua conta e enviaremos um link para definir uma nova senha.
          </p>
        </div>

        <FormField id="forgot-email" label="E-mail" error={errors.email?.message}>
          {(aria) => (
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              maxLength={180}
              placeholder="voce@condominio.com.br"
              {...aria}
              {...register('email')}
            />
          )}
        </FormField>

        {formError ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={pending}>
          Enviar link
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
