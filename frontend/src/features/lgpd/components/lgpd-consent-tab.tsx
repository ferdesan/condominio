import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useMyConsent, useUpdateConsent } from '../lgpd-hooks';

/**
 * Consentimento de tratamento de dados.
 *
 * O servidor deriva o titular do token: o pedido de consulta e atualizacao so
 * faz sentido para quem tem um morador vinculado — no catálogo de papeis, o
 * RESIDENT. Os demais papeis (que gerem o modulo, sem morador vinculado)
 * recebem a vista read-only por construcao: um pedido a `/lgpd/consent` sem
 * morador vinculado falharia, e nao ha outra coletanea para mostrar.
 *
 * O discriminador e o papel, e nao a permissao: o ADMIN carrega `['*']`, que a
 * leitura de `lgpd-consent:create` tambem satisfaz — e esse e justamente o papel
 * que nao tem dados pessoais de titular aqui.
 */
export function LgpdConsentTab() {
  const { user } = useAuth();
  const mayToggle = user?.role === 'RESIDENT';

  const query = useMyConsent({ enabled: mayToggle });
  const update = useUpdateConsent();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const consent = query.data;
  const granted = consent?.granted ?? false;

  function handleToggle(next: boolean): void {
    if (!mayToggle) return;
    setConfirming(next);
  }

  function confirm(): void {
    if (confirming === null || busy) return;
    setBusy(true);
    update.mutate(
      { consentType: 'DATA_PROCESSING', granted: confirming },
      {
        onSuccess: () => {
          toast.success(confirming ? 'Consentimento registrado.' : 'Consentimento revogado.');
          setConfirming(null);
        },
        onSettled: () => setBusy(false),
      },
    );
  }

  if (!mayToggle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consentimento LGPD</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O consentimento de tratamento de dados e registrado por morador, no acesso de cada
            unidade. Por aqui a consulta esta disponível apenas ao próprio titular.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Consentimento LGPD</CardTitle>
          <CardDescription>
            Tratamento de dados pessoais para a gestao interna do condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm">
                  Autorizo o tratamento dos meus dados pessoais para a gestao do condomínio.
                </p>
                {consent?.grantedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Concedido em {formatDateTime(consent.grantedAt)}
                  </p>
                ) : null}
                {consent?.revokedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Revogado em {formatDateTime(consent.revokedAt)}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={granted}
                onCheckedChange={handleToggle}
                disabled={busy || query.isPending}
                aria-label="Autorização de tratamento de dados"
              />
            </div>
          )}
          {consent?.warnings.length ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {consent.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? 'Autorizar tratamento de dados?' : 'Revogar consentimento?'}
        description={
          confirming
            ? 'O condomínio podera continuar tratando os seus dados pessoais para a gestao interna.'
            : 'Seus dados continuarao armazenados, mas deixarao de ser tratados para novas finalidades.'
        }
        actionLabel={confirming ? 'Autorizar' : 'Revogar'}
        variant={confirming ? 'info' : 'warning'}
        loading={busy}
        onCancel={() => setConfirming(null)}
        onConfirm={confirm}
      />
    </div>
  );
}
