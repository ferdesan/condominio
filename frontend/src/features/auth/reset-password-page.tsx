import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LinkIcon, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { applyApiError } from '@/lib/form-errors';
import { AuthShell } from './components/auth-shell';
import { useResetPassword } from './auth-hooks';
import {
  RESET_FIELDS,
  resetPasswordDefaults,
  resetPasswordSchema,
  type ResetPasswordValues,
} from './auth-schema';

/** O token minimo que `resetPasswordSchema` aceita no servidor. */
const MIN_TOKEN_LENGTH = 10;

/**
 * Definicao da nova senha a partir do token do e-mail.
 *
 * **Publica**, e nao redireciona quem ja tem sessao: o link chega por e-mail e
 * precisa funcionar independentemente do que o navegador tenha guardado. Mandar
 * um usuario logado para o painel quebraria justamente o caso em que ele pediu
 * a recuperacao de outro dispositivo.
 *
 * **Token ausente e um estado da tela, e nao um formulario vazio.** Sem
 * `?token=` nao ha o que enviar — mostrar os campos de senha convidaria a
 * preencher uma tela que so podia terminar em recusa.
 *
 * **A recusa e uma so para tres causas.** Desconhecido, ja usado e expirado
 * produzem o mesmo 400 com o mesmo texto no servidor; a tela repete o que veio e
 * oferece pedir um link novo, que e a unica saida em qualquer um dos tres casos.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const token = searchParams.get('token') ?? '';
  // Conferido antes de enviar: o servidor exige dez caracteres, e um token
  // truncado por um cliente de e-mail merece a mesma explicacao que um ausente.
  const hasToken = token.length >= MIN_TOKEN_LENGTH;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: resetPasswordDefaults(),
  });

  const reset = useResetPassword({
    onSuccess: () => {
      toast.success('Senha redefinida. Entre com a nova senha.');
      // `replace` tira da historia a URL que carrega o token: o botao "voltar"
      // nao deve reabrir uma tela que ja cumpriu sua funcao.
      navigate('/login', { replace: true });
    },
    onError: (error: ApiError) => {
      // 400 aqui e sobre o token, e nao sobre os campos de senha — apontar a
      // mensagem a um campo culparia o que a pessoa digitou.
      if (error.status === 400) {
        setFormError(error.message);
        return;
      }
      applyApiError(error, setError, setFormError, RESET_FIELDS);
    },
  });

  const pending = isSubmitting || reset.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // A falha ja foi apresentada por `onError`; aqui so nao se deixa a promessa
    // rejeitar sem dono.
    await reset.mutateAsync({ token, password: values.password }).catch(() => undefined);
  });

  if (!hasToken) {
    return (
      <AuthShell subtitle="Recuperacao de acesso">
        <div className="app-surface space-y-4 p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/15 text-foreground">
            <LinkIcon className="size-6" aria-hidden="true" />
          </span>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Link incompleto</h2>
            <p className="text-sm text-muted-foreground">
              Este endereco nao traz o codigo de recuperacao. Abra o link do e-mail por inteiro, ou
              peca um novo.
            </p>
          </div>

          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link to="/esqueci-senha">Pedir um novo link</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/login">Voltar para o login</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Recuperacao de acesso">
      <form onSubmit={onSubmit} noValidate className="app-surface space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Definir nova senha</h2>
          <p className="text-sm text-muted-foreground">Escolha uma senha nova para entrar.</p>
        </div>

        {/*
          Dito antes do envio, e nao depois: `resetPassword` chama
          `revokeAllForUser`, entao quem estiver logado noutro dispositivo sera
          desconectado. Descobrir isso depois seria descobrir tarde.
        */}
        <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Ao redefinir, sua conta sera desconectada em todos os dispositivos.</span>
        </p>

        <FormField
          id="reset-password"
          label="Nova senha"
          error={errors.password?.message}
          description="Ao menos 8 caracteres, com maiuscula, minuscula e numero."
        >
          {(aria) => (
            <div className="relative">
              <Input
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                maxLength={72}
                className="pr-11"
                {...aria}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
                aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
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
          id="reset-confirm"
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

        {formError ? (
          <div
            role="alert"
            className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <p>{formError}</p>
            {/* A unica saida para as tres causas de recusa e a mesma. */}
            <Link to="/esqueci-senha" className="inline-block font-medium underline">
              Pedir um novo link
            </Link>
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={pending}>
          Redefinir senha
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">Voltar para o login</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
