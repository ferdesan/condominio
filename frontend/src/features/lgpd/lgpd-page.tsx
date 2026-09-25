import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LgpdRequestsTab } from './components/lgpd-requests-tab';
import { LgpdExportTab } from './components/lgpd-export-tab';
import { LgpdConsentTab } from './components/lgpd-consent-tab';

const DESCRIPTION =
  'Seus direitos de titular de dados: solicitar a anonimização dos dados pessoais, exporta-los e registrar o consentimento de tratamento.';

const TABS = ['requests', 'export', 'consent'] as const;
type LgpdTab = (typeof TABS)[number];

/**
 * Porta de entrada do modulo LGPD, fora dos modulos de negocio tradicionais:
 * aparece como a secao "Privacidade", porque trata de direitos, e nao de uma
 * colecao. As tres abas sao visiveis para qualquer papel com `lgpd-request:create`; o que
 * cada uma oferece por dentro segue a permissao do servidor (ADR-005).
 *
 * A aba abre pelo `?tab=export` quando o morador chega pelo perfil.
 */
export function LgpdPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');

  const tab: LgpdTab = TABS.includes(requested as LgpdTab) ? (requested as LgpdTab) : 'requests';

  function handleValueChange(value: string): void {
    if (value === 'requests') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: value }, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="LGPD" description={DESCRIPTION} />

      <Tabs value={tab} onValueChange={handleValueChange}>
        <TabsList aria-label="Privacidade e LGPD">
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="export">Exportar</TabsTrigger>
          <TabsTrigger value="consent">Consentimento</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <LgpdRequestsTab />
        </TabsContent>
        <TabsContent value="export">
          <LgpdExportTab />
        </TabsContent>
        <TabsContent value="consent">
          <LgpdConsentTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
