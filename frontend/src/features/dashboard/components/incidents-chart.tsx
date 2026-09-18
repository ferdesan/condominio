import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { TriangleAlert } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { useChartColors } from '@/hooks/use-chart-colors';
import { formatNumber } from '@/lib/format';
import type { IncidentCategoryTotal } from '@/types/api';
import { rankIncidentCategories } from '../incident-chart-data';

/**
 * Ocorrencias por categoria — o irmao de `ExpensesChart`, e deliberadamente
 * igual a ele: mesma forma (barras horizontais ordenadas, nao pizza), mesma
 * paleta, mesmo rotulo direto no lugar do eixo de valores. Os dois respondem a
 * mesma pergunta sobre coisas diferentes, e devem ler como par.
 *
 * Duas diferencas, e so duas: o valor e contagem e nao dinheiro, e o rotulo do
 * eixo vem de um enum traduzido no cliente — o servidor devolve `incident.category`
 * cru, sem nome nem cor, porque nao ha entidade de categoria por tras.
 *
 * O recorte e a traducao estao em `../incident-chart-data.ts`; aqui fica so o
 * desenho.
 */
export function IncidentsChart({
  data,
  loading,
}: {
  data: IncidentCategoryTotal[];
  loading: boolean;
}) {
  const colors = useChartColors();
  // A ordenacao e a traducao vivem num modulo proprio: o Recharts nao desenha
  // nada no jsdom, entao seria a unica parte deste arquivo sem cobertura.
  const ranked = rankIncidentCategories(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ocorrências por categoria</CardTitle>
        <CardDescription>O que mais gera registro no condomínio.</CardDescription>
      </CardHeader>

      <div className="px-2 pb-5 sm:px-4">
        {loading ? (
          <Skeleton className="mx-2 h-64" />
        ) : ranked.length === 0 ? (
          <div className="px-2">
            {/* Distinto de um grafico em branco: nenhuma ocorrencia registrada
                e uma boa noticia, e precisa ser dita. */}
            <EmptyState
              icon={TriangleAlert}
              title="Nenhuma ocorrência registrada"
              description="Nada a exibir para este condomínio."
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
                dataKey="label"
                stroke={colors.axis}
                tickLine={false}
                axisLine={false}
                width={140}
                fontSize={12}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                {ranked.map((item) => (
                  <Cell key={item.category} fill={colors.series[0]} />
                ))}
                {/* Rotulo direto dispensa o eixo de valores. */}
                <LabelList
                  dataKey="total"
                  position="right"
                  offset={8}
                  className="fill-foreground text-xs tabular-nums"
                  formatter={(value: number) => formatNumber(value)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
