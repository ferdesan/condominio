import { useMemo, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { ButtonTabs, ButtonTabsList, ButtonTabsTrigger } from '@/components/ui/button-tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import {
  useApplyLateFees,
  useCategoryOptions,
  useProviderOptions,
  useUnitOptions,
} from './financial-hooks';
import { SECTIONS, type SectionId } from './financial-labels';
import { CategoriesSection } from './components/categories-section';
import { ClosingSection } from './components/closing-section';
import { ChargesSection } from './components/charges-section';
import { ExpensesSection } from './components/expenses-section';
import { FinancialSummary } from './components/financial-summary';
import { GenerateChargesDialog } from './components/generate-charges-dialog';

const DESCRIPTION =
  'Cobranças das unidades, despesas do condomínio e o plano de contas que classifica as duas.';

/**
 * Modulo financeiro.
 *
 * **Tres recursos sob uma rota.** O menu tem um item so — "Financeiro" —, e o
 * backend expoe cobrancas, despesas e plano de contas sob `/financial`. Eles sao
 * lidos juntos (uma despesa e classificada pela mesma conta que uma cobranca) e
 * separa-los em tres itens de menu obrigaria a navegar entre telas para uma
 * tarefa so. A troca de secao e local: nao ha rota por secao, pelo mesmo motivo
 * que nao ha rota de detalhe (ADR-004).
 *
 * As tres colecoes auxiliares — unidades, prestadores e contas — sao carregadas
 * aqui, e nao dentro de cada secao: as contas alimentam duas secoes, e mante-las
 * num lugar so evita a mesma consulta sair duas vezes ao alternar.
 */
export function FinancialPage() {
  const { can } = useAuth();
  const { selectedId } = useCondominium();
  const [section, setSection] = useState<SectionId>('charges');
  const [generating, setGenerating] = useState(false);
  const [applyingFees, setApplyingFees] = useState(false);
  const [feesResult, setFeesResult] = useState<number | null>(null);
  const applyRef = useRef(false);

  const canGenerate = can('charge:create');
  // Aplicar encargos exige `charge:manage`, e nao `update`: e uma operacao em
  // massa sobre o que ja venceu, e nao a correcao de uma cobranca.
  const canManageCharges = can('charge:manage');

  /*
    O balancete some do alternador de quem nao pode le-lo, como as demais secoes
    ja conferem a propria permissao por dentro. A guarda da rota e `charge:read`,
    e um papel pode ler cobrancas sem ler a prestacao de contas.
  */
  const canReadClosing = can('financial-closing:read');
  const visibleSections = useMemo(
    () => SECTIONS.filter((item) => item.id !== 'closing' || canReadClosing),
    [canReadClosing],
  );

  const unitsQuery = useUnitOptions(selectedId);
  const units = useMemo(() => unitsQuery.data?.data ?? [], [unitsQuery.data]);

  const providersQuery = useProviderOptions(selectedId);
  const providers = useMemo(() => providersQuery.data?.data ?? [], [providersQuery.data]);

  const categoriesQuery = useCategoryOptions(selectedId);
  const categories = useMemo(() => categoriesQuery.data?.data ?? [], [categoriesQuery.data]);

  const applyLateFees = useApplyLateFees({
    onSuccess: (data) => setFeesResult(data.updated),
  });

  if (!selectedId) {
    return (
      <CrudLayout
        header={<PageHeader title="Financeiro" description={DESCRIPTION} />}
        content={
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Selecione um condomínio"
              description="O financeiro e por condomínio. Escolha um no topo da tela para continuar."
            />
          </div>
        }
      />
    );
  }

  return (
    <>
      <CrudLayout
        header={
          <PageHeader
            title="Financeiro"
            description={DESCRIPTION}
            actions={
              <div className="flex flex-wrap gap-2">
                {canManageCharges ? (
                  <Button variant="outline" onClick={() => setApplyingFees(true)}>
                    Aplicar multa e juros
                  </Button>
                ) : null}
                {canGenerate ? (
                  <Button onClick={() => setGenerating(true)}>Gerar cobranças do mês</Button>
                ) : null}
              </div>
            }
          />
        }
        filters={
          <div className="space-y-4">
            <FinancialSummary condominiumId={selectedId} />

            {/*
              Navegação entre seções, e não abas de conteudo independente: o
              estado e local e não vai para a URL, pelo mesmo motivo que não ha
              rota de detalhe (ADR-004).

              Abaixo de `sm` o rotulo inteiro estoura a viewport (360px nao
              comporta quatro palavras lado a lado), entao a aba mostra so o
              icone e o nome volta na tarja. O `aria-label` e o que o leitor de
              tela anuncia — a tarja e reforco visual, nunca a unica fonte do
              significado.
            */}
            <ButtonTabs value={section} onValueChange={(v) => setSection(v as SectionId)}>
              <ButtonTabsList variant="buttons" aria-label="Seções do financeiro">
                {visibleSections.map((item) => (
                  <Tooltip key={item.id} label={item.label}>
                    <ButtonTabsTrigger value={item.id} aria-label={item.label}>
                      <item.icon className="size-4 sm:hidden" aria-hidden="true" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </ButtonTabsTrigger>
                  </Tooltip>
                ))}
              </ButtonTabsList>
            </ButtonTabs>
          </div>
        }
        content={
          <div className="p-4">
            {section === 'charges' ? (
              <ChargesSection condominiumId={selectedId} units={units} categories={categories} />
            ) : section === 'expenses' ? (
              <ExpensesSection
                condominiumId={selectedId}
                categories={categories}
                providers={providers}
              />
            ) : section === 'categories' ? (
              <CategoriesSection condominiumId={selectedId} />
            ) : (
              <ClosingSection condominiumId={selectedId} />
            )}
          </div>
        }
      />

      {generating ? (
        <GenerateChargesDialog
          condominiumId={selectedId}
          categories={categories}
          onClose={() => setGenerating(false)}
        />
      ) : null}

      {/*
        Aplicar encargos mexe em todas as cobranças vencidas do condomínio de uma
        vez e usa os percentuais do tenant, que não sao escolhidos aqui. Pedir
        confirmação e parte da ação, e não um enfeite.
      */}
      <ConfirmDialog
        open={applyingFees}
        title="Aplicar multa e juros?"
        description="Todas as cobranças vencidas deste condomínio recebem os percentuais configurados na administradora. O job diário já faz isso; use quando precisar do número atualizado agora."
        actionLabel="Aplicar"
        variant="warning"
        loading={applyLateFees.isPending}
        onCancel={() => setApplyingFees(false)}
        onConfirm={() => {
          // O `isPending` da mutacao so muda no proximo tick, entao dois cliques
          // no mesmo passariam os dois. O trinco fecha na hora.
          if (applyRef.current) return;
          applyRef.current = true;
          applyLateFees.mutate(
            { condominiumId: selectedId },
            {
              onSettled: () => {
                applyRef.current = false;
                setApplyingFees(false);
              },
            },
          );
        }}
      />

      {/*
        O número de cobranças atingidas so volta uma vez, na resposta: sem
        mostra-lo, "aplicado" nao diria se alguma coisa mudou.
      */}
      <ConfirmDialog
        open={feesResult !== null}
        title="Encargos aplicados"
        description={
          feesResult !== null
            ? `${formatNumber(feesResult)} cobranças vencidas foram atualizadas.`
            : undefined
        }
        actionLabel="Fechar"
        cancelLabel="Fechar"
        onCancel={() => setFeesResult(null)}
        onConfirm={() => setFeesResult(null)}
      />
    </>
  );
}
