import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useChartColors } from '@/hooks/use-chart-colors';
import { formatCompactCurrency, formatCurrency } from '@/lib/format';
import type { FinancialSeriesPoint } from '@/types/api';
import { ChartTooltip } from './chart-tooltip';

/**
 * Faturado x recebido ao longo dos meses: mudanca no tempo pede linha. As duas
 * series sao a mesma medida (R$), entao dividem um unico eixo — nunca dois.
 */
export function FinancialChart({
  data,
  loading,
}: {
  data: FinancialSeriesPoint[];
  loading: boolean;
}) {
  const colors = useChartColors();
  const series = [
    { key: 'billed' as const, name: 'Faturado', color: colors.series[0] },
    { key: 'received' as const, name: 'Recebido', color: colors.series[1] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturado x recebido</CardTitle>
        <CardDescription>Evolução mensal das cobranças do condomínio.</CardDescription>
      </CardHeader>

      <div className="px-2 pb-4 sm:px-4">
        {loading ? (
          <Skeleton className="mx-2 h-64" />
        ) : (
          <>
            {/* Legenda propria: dois marcadores, texto em tokens de tinta. */}
            <ul className="mb-2 flex flex-wrap items-center gap-4 px-3 text-sm">
              {series.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </li>
              ))}
            </ul>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={colors.axis}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={12}
                />
                <YAxis
                  stroke={colors.axis}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={64}
                  fontSize={12}
                  tickFormatter={(value: number) => formatCompactCurrency(value)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: colors.axis, strokeDasharray: '4 4' }}
                />
                {series.map((item) => (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    name={item.name}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: colors.surface }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* A mesma serie em texto: leitura alternativa ao canal de cor. */}
            <details className="mt-2 px-3">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Ver os números em tabela
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Mês
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">
                        Faturado
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Recebido
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((point) => (
                      <tr key={point.referenceMonth} className="border-b border-border/60">
                        <td className="py-2 pr-4">{point.label}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {formatCurrency(point.billed)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(point.received)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}
