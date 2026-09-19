import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useCondominium } from '@/hooks/use-condominium';
import { formatCurrency, formatDate, formatNumber, formatReferenceMonth } from '@/lib/format';
import type { MonthlyStatement, StatementLine } from '@/types/financial';
import { useCloseMonth, useClosing, useReopenMonth } from '../financial-hooks';
import { openingBalanceProvenance } from '../financial-labels';

/** Competencia corrente, no formato do `input type="month"`. */
const currentMonth = () => new Date().toISOString().slice(0, 7);

export interface ClosingSectionProps {
  condominiumId: string | null;
}

/**
 * O balancete do mes: saldo anterior, o que entrou e o que saiu por categoria,
 * resultado e saldo final.
 *
 * **Regime de caixa**, e o texto da tela diz isso em palavras: entra o que foi
 * pago no mes e sai o que foi pago no mes, e nao o que foi faturado ou incorrido.
 * Um leitor que conhece contabilidade esperaria competencia e leria o numero
 * errado sem esse aviso.
 *
 * A leitura mora aqui dentro, e nao no nivel da pagina: a secao so monta quando
 * escolhida, e e isso que mantem o boot de `/financeiro` sem esta requisicao.
 */
export function ClosingSection({ condominiumId }: ClosingSectionProps) {
  const { can } = useAuth();
  const { selected } = useCondominium();
  const [referenceMonth, setReferenceMonth] = useState(currentMonth);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const actingRef = useRef(false);

  const canClose = can('financial-closing:create');
  const canReopen = can('financial-closing:manage');

  const statement = useClosing(condominiumId, referenceMonth);

  const settle = () => {
    actingRef.current = false;
  };

  const closeMonth = useCloseMonth({
    onSuccess: () => {
      settle();
      setConfirming(false);
      toast.success(`Balancete de ${formatReferenceMonth(referenceMonth)} fechado.`);
    },
    onError: (error) => {
      settle();
      setConfirming(false);
      setRefusal(error.message);
    },
  });

  const reopenMonth = useReopenMonth({
    onSuccess: () => {
      settle();
      toast.success(`Balancete de ${formatReferenceMonth(referenceMonth)} reaberto.`);
    },
    onError: (error) => {
      settle();
      setRefusal(error.message);
    },
  });

  /**
   * Trinco por `useRef`, e nao por `isPending`: o estado da mutacao so muda no
   * tick seguinte, entao dois cliques rapidos disparariam duas requisicoes. Mesmo
   * padrao de `financial-page.tsx` e `charges-section.tsx`.
   */
  const act = (run: () => void) => {
    if (actingRef.current || !condominiumId) return;
    actingRef.current = true;
    setRefusal(null);
    run();
  };

  const data = statement.data;
  const isClosed = data?.status === 'CLOSED';
  const hasMovement = Boolean(data && (data.income.length > 0 || data.expense.length > 0));

  return (
    <section aria-labelledby="closing-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="closing-title" className="text-sm font-semibold">
            Balancete mensal{selected ? ` · ${selected.name}` : ''}
          </h2>
          <p className="text-xs text-muted-foreground">
            Regime de caixa: entra o que foi pago no mês e sai o que foi pago no mês.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="closing-month">Competência</Label>
            <Input
              id="closing-month"
              type="month"
              value={referenceMonth}
              onChange={(event) => {
                setReferenceMonth(event.target.value);
                setRefusal(null);
              }}
            />
          </div>

          {isClosed && canReopen ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                act(() => reopenMonth.mutate({ condominiumId: condominiumId!, referenceMonth }))
              }
            >
              Reabrir mês
            </Button>
          ) : null}

          {!isClosed && canClose ? (
            <Button type="button" onClick={() => setConfirming(true)}>
              Fechar mês
            </Button>
          ) : null}

          {/*
            A secao resume; o documento completo — com um lancamento por
            pagamento recebido e por despesa paga — mora na rota propria
            (ADR-001), e **e de la que ele sai**, impresso ou em CSV (ADR-005).

            Exportar tambem daqui produziria dois arquivos de mesmo nome com
            conteudos diferentes, porque o payload desta secao e o resumo e nao
            o documento inteiro. Por isso o link e uma saida e nao um atalho: ele
            leva a unica tela que tem tudo o que ela exporta.

            Sempre visivel, inclusive sem `statement.data`: a rota le o mes por
            conta propria e sabe dizer que ele nao existe, o que e melhor do que
            o link sumir sem explicacao enquanto a secao carrega.
          */}
          <Button asChild variant="outline">
            <Link to={`/financeiro/balancete/${referenceMonth}`}>Ver o documento completo</Link>
          </Button>
        </div>
      </div>

      {refusal ? (
        <p role="alert" className="text-sm text-destructive">
          {refusal}
        </p>
      ) : null}

      {statement.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o balancete desta competência.
        </p>
      ) : statement.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !data ? null : !hasMovement ? (
        <>
          <BalancePanel statement={data} />
          <EmptyState
            icon={Wallet}
            title={`Nenhum lançamento em ${formatReferenceMonth(referenceMonth)}`}
            description="Nenhum pagamento recebido e nenhuma despesa paga nesta competência. O saldo segue o do mês anterior."
          />
        </>
      ) : (
        <>
          <BalancePanel statement={data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <LineTable
              id="closing-income"
              title="Entradas por categoria"
              lines={data.income}
              total={data.totalIncome}
            />
            <LineTable
              id="closing-expense"
              title="Saídas por categoria"
              lines={data.expense}
              total={data.totalExpense}
            />
          </div>

          <Card className="p-4">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Resultado do mês</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatCurrency(data.result)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Saldo final</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatCurrency(data.closingBalance)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Inadimplência da competência</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatCurrency(data.delinquency.amount)}
                </dd>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(data.delinquency.count)} cobranças vencidas · fora do resultado
                </p>
              </div>
            </dl>
          </Card>
        </>
      )}

      {data && data.unresolvedPaidExpenses.count > 0 ? (
        <Card className="border-warning p-4">
          <h3 className="text-sm font-semibold">Pagas sem data de pagamento</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(data.unresolvedPaidExpenses.count)} despesa(s) desta competência somam{' '}
            {formatCurrency(data.unresolvedPaidExpenses.total)} e estão marcadas como pagas sem a
            data. <strong>Não entram em nenhum total</strong> porque não pertencem a mês de caixa
            algum — informe a data de pagamento para que voltem à conta.
          </p>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirming}
        variant="warning"
        title={`Fechar o balancete de ${formatReferenceMonth(referenceMonth)}?`}
        description="Depois de fechado, o mês passa a recusar pagamento e despesa paga com data nesta competência, e o documento deixa de ser recalculado. Reabrir é possível e fica registrado."
        actionLabel="Fechar mês"
        loading={closeMonth.isPending}
        onConfirm={() =>
          act(() => closeMonth.mutate({ condominiumId: condominiumId!, referenceMonth }))
        }
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

/** Saldo de abertura, com a procedencia, e o estado do mes. */
function BalancePanel({ statement }: { statement: MonthlyStatement }) {
  return (
    <Card role="region" aria-labelledby="closing-balances-title" className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="closing-balances-title" className="text-sm font-semibold">
          {formatReferenceMonth(statement.referenceMonth)}
        </h3>
        {statement.status === 'CLOSED' ? (
          <Badge variant="neutral">
            Fechado em {formatDate(statement.closedAt)}
            {statement.closedBy?.name ? ` por ${statement.closedBy.name}` : ''}
          </Badge>
        ) : (
          <Badge variant="outline">Em aberto</Badge>
        )}
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
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
      </dl>

      {statement.reopenCount > 0 ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          Esta competência já foi reaberta {formatNumber(statement.reopenCount)} vez(es).
        </p>
      ) : null}
    </Card>
  );
}

/** Uma das duas tabelas por categoria, com o total que sai das proprias linhas. */
function LineTable({
  id,
  title,
  lines,
  total,
}: {
  id: string;
  title: string;
  lines: StatementLine[];
  total: number;
}) {
  return (
    <Card className="p-4">
      <h3 id={`${id}-title`} className="mb-2 text-sm font-semibold">
        {title}
      </h3>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lançamento.</p>
      ) : (
        <table aria-labelledby={`${id}-title`} className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1 font-medium">
                Categoria
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.categoryId ?? 'sem-categoria'} className="border-t border-border">
                <td className="py-1.5">{line.name}</td>
                <td className="py-1.5 text-right tabular-nums">{formatCurrency(line.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right tabular-nums">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </Card>
  );
}
