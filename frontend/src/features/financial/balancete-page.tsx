import { Link, useParams } from 'react-router-dom';
import { Building2, FileClock, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ForbiddenPage } from '@/features/misc/forbidden-page';
import { useCondominium } from '@/hooks/use-condominium';
import { formatCurrency, formatDate, formatNumber, formatReferenceMonth } from '@/lib/format';
import type { MonthlyStatement } from '@/types/financial';
import { downloadClosingCsv } from './closing-csv';
import { ClosingEntriesTable } from './closing-entries-table';
import { useClosing, useClosingEntries } from './financial-hooks';
import { isReferenceMonth, openingBalanceProvenance } from './financial-labels';

const DESCRIPTION =
  'Prestação de contas da competência: o resumo por categoria e cada pagamento e despesa que o produziu.';

/**
 * O balancete de um mes como documento, na rota `/financeiro/balancete/:mes`.
 *
 * **Segunda rota de detalhe do sistema, e segunda rota fora do menu** — as duas
 * excecoes tem precedente, e o [ADR-001](.compozy/tasks/balancete-detalhe/adrs/adr-001.md)
 * registra por que uma prestacao de contas as merece: e material de consulta ao
 * qual se volta, que se imprime e se manda para alguem. Um dialogo fecha num
 * clique fora e nao tem endereco.
 *
 * A guarda da rota e `financial-closing:read`, **e nao** o `charge:read` de
 * `/financeiro`: quem le cobrancas sem ler a prestacao de contas nao deve
 * alcancar o documento digitando o endereco.
 *
 * Duas leituras independentes, como em `condominium-detail-page.tsx`: o resumo e
 * os lancamentos. A pagina usa `PageHeader` e cartoes proprios, e nao
 * `CrudLayout`, que e a moldura das listagens.
 *
 * **E daqui que o documento sai**, impresso ou em CSV, e so daqui
 * ([ADR-005](.compozy/tasks/balancete-detalhe/adrs/adr-005.md)): a secao de
 * `/financeiro` mostra o resumo e aponta para ca. Um lugar exporta, e exporta
 * tudo o que mostra.
 */
export function BalancetePage() {
  const { mes = '' } = useParams<{ mes: string }>();
  const { selectedId, selected } = useCondominium();

  // Competencia malformada nao vira requisicao: o servidor a recusaria com 422,
  // e para quem chegou pelo link o endereco simplesmente nao existe.
  const referenceMonth = isReferenceMonth(mes) ? mes : '';

  const statement = useClosing(selectedId, referenceMonth);
  const entries = useClosingEntries(selectedId, referenceMonth);

  if (!referenceMonth) return <MonthNotFound />;

  if (!selectedId) {
    return (
      <>
        <PageHeader title="Balancete" description={DESCRIPTION} />
        <EmptyState
          icon={Building2}
          title="Selecione um condomínio"
          description="O balancete e apurado por condomínio. Escolha um no topo da tela para continuar."
        />
      </>
    );
  }

  if (statement.isPending || entries.isPending) return <BalanceteSkeleton month={mes} />;

  // As duas leituras sao o mesmo documento, e por isso qualquer uma das duas
  // falhar derruba a tela: mostrar o resumo sozinho, calado sobre a lista que
  // nao veio, seria meia prestacao de contas com cara de inteira.
  //
  // 403 e a falta de escopo sobre este condominio — o papel alcanca a rota e nao
  // aquele documento. O resto (404, 422) e endereco que nao resolve, e para quem
  // colou o link os dois sao a mesma coisa.
  if (statement.isError || entries.isError) {
    const status = statement.error?.status ?? entries.error?.status;
    if (status === 403) return <ForbiddenPage />;
    return <MonthNotFound />;
  }

  const data = statement.data;
  const { entries: rows, frozen } = entries.data;

  /**
   * Documento fechado antes de os lancamentos passarem a ser gravados.
   *
   * `frozen` diz que as linhas vieram do fechamento; vindo vazias com totais
   * acima de zero, elas nao existem — e nao "o mes nao teve movimento". Uma
   * tabela vazia aqui afirmaria a segunda coisa, que e falsa, dentro de um
   * documento cuja razao de ser e poder ser conferido.
   */
  const predatesEntries = frozen && rows.length === 0 && data.totalIncome + data.totalExpense > 0;

  /*
    A raiz do documento e os controles, marcados para a folha de impressao.

    O `@media print` de `index.css` nao muda: ele procura `.print-document` e
    `.print-hide`, que sao nomes de classe e nao nomes de tela, e e isso que
    torna esta migracao barata (ADR-005). O embrulho cobre tambem o `PageHeader`
    — a casca autenticada some na impressao, e sem o titulo a folha nao diria de
    que mes nem de que condominio ela e.

    Exportar e imprimir leem `rows`, que e o mes inteiro como ele chegou, e nao o
    recorte que o filtro e a paginacao da tabela mostram. O arquivo tem de
    concordar com o documento, que e o que o ADR-004 existe para garantir.
  */
  return (
    <div className="print-document">
      <PageHeader
        title={`Balancete de ${formatReferenceMonth(data.referenceMonth)}`}
        description={selected ? `${selected.name} · ${DESCRIPTION}` : DESCRIPTION}
        actions={
          <div className="print-hide flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Imprimir
            </Button>
            <Button type="button" variant="outline" onClick={() => downloadClosingCsv(data, rows)}>
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Exportar CSV
            </Button>
            <Button asChild variant="outline">
              <Link to="/financeiro">Voltar para o financeiro</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <SummaryCard statement={data} />

        <Card role="region" aria-labelledby="closing-entries-title" className="p-4">
          <h2 id="closing-entries-title" className="mb-3 text-sm font-semibold">
            Lançamentos
          </h2>

          {predatesEntries ? (
            <EmptyState
              icon={FileClock}
              title="Documento anterior ao registro dos lançamentos"
              description="Esta competência foi fechada antes de o sistema passar a gravar cada pagamento e cada despesa. Os totais acima continuam valendo; os lançamentos que os produziram não foram registrados na época."
            />
          ) : (
            <ClosingEntriesTable entries={rows} frozen={frozen} />
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Resumo do mes, com o estado dele em destaque.
 *
 * Cartoes proprios, e nao os da secao de `/financeiro`: as duas telas mostram o
 * mesmo mes e o ADR-001 registra essa duplicacao como o preco da rota. O que
 * esta tela acrescenta e dizer, em palavras, de qual dos dois estados os numeros
 * vieram — um mes aberto ainda muda, e um documento nao.
 */
function SummaryCard({ statement }: { statement: MonthlyStatement }) {
  const closed = statement.status === 'CLOSED';

  return (
    <Card role="region" aria-labelledby="closing-summary-title" className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="closing-summary-title" className="text-sm font-semibold">
          Resumo da competência
        </h2>
        {closed ? (
          <Badge variant="neutral">
            Fechado em {formatDate(statement.closedAt)}
            {statement.closedBy?.name ? ` por ${statement.closedBy.name}` : ''}
          </Badge>
        ) : (
          <Badge variant="outline">Em aberto</Badge>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {closed
          ? 'Documento fechado: os números e os lançamentos foram congelados no fechamento e não são mais recalculados.'
          : 'Mês em aberto: os números são recalculados a cada leitura e ainda podem mudar até o fechamento.'}
      </p>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="text-xs text-muted-foreground">Saldo anterior</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatCurrency(statement.openingBalance.amount)}
          </dd>
          <p className="text-xs text-muted-foreground">
            {openingBalanceProvenance(statement.openingBalance)}
          </p>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Entradas</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatCurrency(statement.totalIncome)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saídas</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatCurrency(statement.totalExpense)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Resultado do mês</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatCurrency(statement.result)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo final</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatCurrency(statement.closingBalance)}
          </dd>
        </div>
      </dl>

      {statement.reopenCount > 0 ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Esta competência já foi reaberta {formatNumber(statement.reopenCount)} vez(es).
        </p>
      ) : null}
    </Card>
  );
}

/** O endereco nao resolve: competencia malformada, sem escopo ou inexistente. */
function MonthNotFound() {
  return (
    <EmptyState
      icon={FileText}
      title="Balancete não encontrado"
      description="A competência não existe, está fora do seu acesso ou o endereço esta incorreto."
      action={
        <Button asChild variant="outline">
          <Link to="/financeiro">Voltar para o financeiro</Link>
        </Button>
      }
    />
  );
}

/** Segura a posicao dos blocos para que a pagina nao salte quando os dados chegam. */
function BalanceteSkeleton({ month }: { month: string }) {
  return (
    <>
      <PageHeader
        title={`Balancete de ${formatReferenceMonth(month)}`}
        description="Carregando a prestação de contas..."
      />
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </div>
    </>
  );
}
