/**
 * O recorte e os rotulos do grafico de ocorrencias por categoria.
 *
 * Modulo proprio por duas razoes. A primeira e a de sempre: uma funcao
 * exportada ao lado de um componente levanta
 * `react-refresh/only-export-components`. A segunda e que **isto e o que da
 * para testar**: o Recharts mede o container para desenhar, e no jsdom a medida
 * e sempre zero — nenhum rotulo de eixo chega ao DOM. Deixar a ordenacao e a
 * traducao dentro do componente seria deixa-las sem cobertura.
 */

import { CATEGORY_LABELS } from '@/features/incidents/incident-labels';
import type { IncidentCategory } from '@/types/incident';
import type { IncidentCategoryTotal } from '@/types/api';

/**
 * Teto de barras, igual ao do grafico irmao de despesas.
 *
 * O enum tem oito categorias, e as duas menores costumam ser ruido numa leitura
 * de relance.
 */
export const MAX_BARS = 6;

export type RankedIncidentCategory = IncidentCategoryTotal & {
  /** Nome do produto, ou o valor cru quando o enum do cliente nao o conhece. */
  label: string;
};

/**
 * Ordena pelo maior total, corta no teto e traduz a categoria.
 *
 * **Nao descarta o que nao reconhece.** O servidor seleciona `incident.category`
 * cru; uma categoria acrescentada la e ainda sem rotulo aqui aparece com o
 * proprio identificador — visivelmente incompleta, e nunca silenciosamente
 * ausente do grafico.
 *
 * Copia antes de ordenar: `sort` e destrutivo, e o argumento vem do cache do
 * React Query, que outras partes da tela tambem leem.
 */
export function rankIncidentCategories(
  data: readonly IncidentCategoryTotal[],
): RankedIncidentCategory[] {
  return [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_BARS)
    .map((item) => ({
      ...item,
      label: CATEGORY_LABELS[item.category as IncidentCategory] ?? item.category,
    }));
}
