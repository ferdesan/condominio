import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { PieChart } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { useChartColors } from '@/hooks/use-chart-colors';
import { formatCurrency } from '@/lib/format';
import type { CategoryTotal } from '@/types/api';

/**
 * Comparar magnitude entre categorias: barras horizontais ordenadas, nao pizza
 * (angulos sao dificeis de comparar). A identidade vem do rotulo no eixo, entao
 * uma unica cor basta — pintar cada barra de um tom diferente nao acrescenta
 * informacao e gasta a paleta categorica a toa.
 */
export function ExpensesChart({ data, loading }: { data: CategoryTotal[]; loading: boolean }) {
  const colors = useChartColors();
  const ranked = [...data].sort((a, b) => b.total - a.total).slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por categoria</CardTitle>
        <CardDescription>Maiores gastos do condomínio no período.</CardDescription>
      </CardHeader>

      <div className="px-2 pb-5 sm:px-4">
        {loading ? (
          <Skeleton className="mx-2 h-64" />
        ) : ranked.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon={PieChart}
              title="Sem despesas lancadas"
              description="Nada a exibir no período."
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, ranked.length * 48)}>
            <BarChart
              data={ranked}
              layout="vertical"
              margin={{ top: 4, right: 84, bottom: 4, left: 4 }}
              barCategoryGap={10}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                stroke={colors.axis}
                tickLine={false}
                axisLine={false}
                width={140}
                fontSize={12}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                {ranked.map((item) => (
                  <Cell key={item.categoryId} fill={colors.series[0]} />
                ))}
                {/* Rotulo direto dispensa o eixo de valores. */}
                <LabelList
                  dataKey="total"
                  position="right"
                  offset={8}
                  className="fill-foreground text-xs tabular-nums"
                  formatter={(value: number) => formatCurrency(value)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
