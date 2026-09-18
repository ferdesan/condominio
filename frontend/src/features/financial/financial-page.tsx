import { useMemo, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CrudLayout } from '@/components/common/crud-layout';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
              rota de detalhe (ADR-004). `role="tablist"` daria a promessa de
              navegação por setas que estes botões não cumprem, entao eles sao
              botões comuns numa barra nomeada.
            */}
            <nav aria-label="Seções do financeiro" className="flex flex-wrap gap-2">
              {SECTIONS.map((item) => {
                const isActive = section === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(isActive && 'pointer-events-none')}
                    onClick={() => setSection(item.id)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </nav>
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
            ) : (
              <CategoriesSection condominiumId={selectedId} />
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
