import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarClock,
  DoorOpen,
  Mail,
  TrendingDown,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatNumber, formatPercent, formatReferenceMonth } from '@/lib/format';
import { useCondominium } from '@/hooks/use-condominium';
import type {
  ActivityEntry,
  CategoryTotal,
  DashboardOverview,
  FinancialSeriesPoint,
  IncidentCategoryTotal,
} from '@/types/api';
import { ActivityFeed } from './components/activity-feed';
import { ExpensesChart } from './components/expenses-chart';
import { IncidentsChart } from './components/incidents-chart';
import { FinancialChart } from './components/financial-chart';
import { StatCard } from './components/stat-card';

export function DashboardPage() {
  const { selectedId, selected, isLoading: loadingCondominiums } = useCondominium();
  const params = { condominiumId: selectedId };
  const enabled = Boolean(selectedId);

  const overview = useQuery({
    queryKey: ['dashboard', 'overview', selectedId],
    queryFn: () => apiGet<DashboardOverview>('/dashboard/overview', { params }),
    enabled,
  });

  const series = useQuery({
    queryKey: ['dashboard', 'financial-series', selectedId],
    queryFn: () =>
      apiGet<FinancialSeriesPoint[]>('/dashboard/financial-series', {
        params: { ...params, months: 6 },
      }),
    enabled,
  });

  const expenses = useQuery({
    queryKey: ['dashboard', 'expenses-by-category', selectedId],
    queryFn: () => apiGet<CategoryTotal[]>('/dashboard/expenses-by-category', { params }),
    enabled,
  });

  /**
   * Irma de `expenses`: mesmo parametro, mesma guarda, mesma chave por
   * condominio. A rota existia desde o inicio e nenhuma tela a chamava.
   */
  const incidents = useQuery({
    queryKey: ['dashboard', 'incidents-by-category', selectedId],
    queryFn: () => apiGet<IncidentCategoryTotal[]>('/dashboard/incidents-by-category', { params }),
    enabled,
  });

  const activity = useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: () => apiGet<ActivityEntry[]>('/dashboard/recent-activity'),
  });

  if (!loadingCondominiums && !selectedId) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhum condominio disponivel"
        description="Cadastre um condominio ou peca acesso ao administrador para ver os indicadores."
      />
    );
  }

  const data = overview.data;
  const loading = overview.isPending;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          selected
            ? `${selected.name} · competencia ${formatReferenceMonth(data?.referenceMonth)}`
            : 'Carregando condominio...'
        }
      />

      <section
        aria-label="Indicadores principais"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Unidades ocupadas"
          value={`${formatNumber(data?.units.occupied)} / ${formatNumber(data?.units.total)}`}
          hint={data ? `${formatPercent(data.units.occupancyRate)} de ocupacao` : undefined}
          icon={DoorOpen}
          loading={loading}
        />
        <StatCard
          label="Moradores"
          value={formatNumber(data?.people.residents)}
          hint={data ? `${formatNumber(data.people.employees)} funcionarios ativos` : undefined}
          icon={Users}
          loading={loading}
        />
        <StatCard
          label="Recebido no mes"
          value={formatCurrency(data?.finance.received)}
          hint={data ? `de ${formatCurrency(data.finance.billed)} faturados` : undefined}
          icon={Wallet}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Inadimplencia"
          value={formatPercent(data?.finance.delinquencyRate)}
          hint={data ? `${formatCurrency(data.finance.overdue)} em atraso` : undefined}
          icon={TrendingDown}
          tone={data && data.finance.delinquencyRate > 15 ? 'destructive' : 'default'}
          loading={loading}
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FinancialChart data={series.data ?? []} loading={series.isPending} />
        </div>
        <ExpensesChart data={expenses.data ?? []} loading={expenses.isPending} />
      </section>

      <section
        aria-label="Pendencias operacionais"
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Ocorrencias abertas"
          value={formatNumber(data?.operations.openIncidents)}
          icon={TriangleAlert}
          tone={data && data.operations.openIncidents > 0 ? 'warning' : 'default'}
          loading={loading}
        />
        <StatCard
          label="Reservas pendentes"
          value={formatNumber(data?.operations.pendingReservations)}
          icon={CalendarClock}
          loading={loading}
        />
        <StatCard
          label="Correspondencias a retirar"
          value={formatNumber(data?.operations.pendingCorrespondences)}
          icon={Mail}
          loading={loading}
        />
        <StatCard
          label="Manutencoes proximas"
          value={formatNumber(data?.operations.upcomingMaintenances)}
          icon={CalendarClock}
          loading={loading}
        />
      </section>

      {/*
        Logo depois das pendencias operacionais, e nao junto dos graficos
        financeiros: a pergunta que ele responde — "de que sao as ocorrencias?" —
        e a continuacao natural de "quantas estao abertas?", que e a primeira
        tarja da secao acima.
      */}
      <section className="mt-4">
        <IncidentsChart data={incidents.data ?? []} loading={incidents.isPending} />
      </section>

      <section className="mt-4">
        <ActivityFeed data={activity.data ?? []} loading={activity.isPending} />
      </section>
    </>
  );
}
