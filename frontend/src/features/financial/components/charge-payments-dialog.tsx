import { Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Charge, Payment } from '@/types/financial';
import { useChargePayments } from '../financial-hooks';
import { PAYMENT_METHOD_LABELS } from '../financial-labels';

export interface ChargePaymentsDialogProps {
  charge: Charge;
  onClose: () => void;
}

/**
 * O historico de baixas de uma cobranca.
 *
 * **So le.** `/financial/payments` nao tem criacao, edicao nem exclusao — a
 * baixa acontece por `POST /financial/charges/:id/payments`, que e o
 * `RegisterPaymentDialog`. Oferecer um botao de lancar aqui duplicaria aquele
 * caminho e faria esta tela parecer um segundo lugar de registro, que ela nao e.
 *
 * **Existe porque uma cobranca aceita baixa parcial.** A listagem mostra o valor
 * e a situacao; o que ela nao consegue mostrar e que "R$ 420 de R$ 600" veio de
 * tres lancamentos em datas diferentes. Essa e a pergunta que so este dialogo
 * responde.
 *
 * **Sem ordenacao e sem paginacao.** O servidor devolve `paidAt DESC` por
 * padrao, e `paidAt` **nao** esta no conjunto ordenavel dele — um cabecalho
 * clicavel aqui mandaria uma chave que seria descartada em silencio. A consulta
 * pede o historico inteiro da cobranca, que e curto por natureza.
 */
export function ChargePaymentsDialog({ charge, onClose }: ChargePaymentsDialogProps) {
  const query = useChargePayments(charge.id);
  const payments = query.data?.data ?? [];

  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const columns: Column<Payment>[] = [
    {
      key: 'paidAt',
      label: 'Recebido em',
      render: (_value, row) => (
        <span className="whitespace-nowrap">{formatDateTime(row.paidAt)}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (_value, row) => <span className="tabular-nums">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'method',
      label: 'Forma',
      render: (_value, row) => PAYMENT_METHOD_LABELS[row.method] ?? row.method,
    },
    {
      key: 'transactionId',
      label: 'Identificador',
      // Ausente na maioria das baixas manuais; o traco diz isso sem sugerir erro.
      render: (_value, row) =>
        row.transactionId ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'notes',
      label: 'Observação',
      render: (_value, row) =>
        row.notes ? (
          <span className="text-muted-foreground">{row.notes}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamentos da cobrança</DialogTitle>
          <DialogDescription>
            Historico de baixas. Para registrar uma nova, use &ldquo;Registrar pagamento&rdquo; na
            lista.
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Nao foi possivel carregar os pagamentos. {query.error.message}
          </p>
        ) : payments.length === 0 ? (
          // Distinto de uma tabela de zero linhas: cobranca em aberto e o estado
          // normal, e nao uma falha de carregamento.
          <EmptyState
            icon={Receipt}
            title="Nenhum pagamento registrado"
            description="Esta cobrança ainda não recebeu nenhuma baixa."
          />
        ) : (
          <div className="space-y-3">
            <DataTable columns={columns} data={payments} idKey="id" searchable={false} />

            {/*
              A soma e do que esta na tabela, e a tabela traz o histórico
              inteiro da cobrança — não e um subtotal de pagina. Comparada ao
              valor da cobrança, ela explica um saldo parcial.
            */}
            <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t pt-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Valor da cobrança</dt>
                <dd className="tabular-nums">{formatCurrency(charge.amount)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Total recebido</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(total)}</dd>
              </div>
            </dl>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
