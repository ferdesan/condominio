import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { ProfileDetailsForm } from './components/profile-details-form';
import { PasswordForm } from './components/password-form';
import { SessionsPanel } from './components/sessions-panel';

const DESCRIPTION =
  'Sua conta: como voce aparece no sistema, a senha de acesso e onde ela esta aberta. Nada aqui depende do condominio selecionado.';

/**
 * Meu perfil.
 *
 * **Fora da navegacao, de proposito.** Chega-se por `/perfil` pelo menu do
 * usuario na topbar, e nao pela barra lateral: a lateral organiza o produto por
 * modulo de negocio, e a conta de quem esta olhando nao e um deles.
 *
 * **Sem guarda de permissao.** As quatro rotas que esta tela usa sao protegidas
 * apenas por `authenticate` em `auth.routes.ts` — o alvo vem do token, entao uma
 * pessoa sempre pode editar a propria conta e nunca a de outra. Inventar uma
 * permissao aqui esconderia a tela de quem a API atenderia; e a mesma razao pela
 * qual `/notificacoes` tambem nao declara nenhuma.
 *
 * **Tres blocos porque sao tres rotas**, com efeitos que nao se misturam: gravar
 * o nome nao toca em sessao nenhuma, trocar a senha derruba todas, e encerrar as
 * sessoes nao mexe na senha. Um formulario unico faria um "Salvar" ambiguo poder
 * deslogar quem so corrigiu o telefone.
 *
 * O que o servidor guarda e esta tela **nao** oferece: `avatarUrl`, sem rota de
 * upload; `locale`, sem i18n que o consuma; e `emailNotifications` /
 * `pushNotifications`, que nenhum despachante le. Sao interruptores ligados a
 * nada ate existir o outro lado.
 */
export function ProfilePage() {
  const { user, initializing } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description={DESCRIPTION} />

      {/*
        O `ProtectedRoute` ja garante a sessao, entao `user` nulo aqui so
        acontece na janela em que o boot ainda revalida o token guardado.
      */}
      {initializing || !user ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <ProfileDetailsForm user={user} />
          <PasswordForm />
          <SessionsPanel />

          {/*
            A porta de entrada do titular de dados (ADR-005): os direitos LGPD
            do morador moram na pagina /lgpd, e o perfil e o lugar onde ele os
            procura. O link abre direto a aba de exportacao — a mesma que o
            fluxo de "Solicitar exclusao de dados" usa para explicar o que e
            exportavel antes do pedido.
          */}
          {user.role === 'RESIDENT' ? (
            <Card>
              <CardHeader>
                <CardTitle>Seus dados pessoais</CardTitle>
                <CardDescription>
                  Exerca os seus direitos de titular de dados: exportar o que o condominio guarda
                  sobre voce ou solicitar a anonimizacao.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/lgpd?tab=export">
                    <ShieldAlert className="size-4" aria-hidden="true" />
                    Solicitar exclusao de dados
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
