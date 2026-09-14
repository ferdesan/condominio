import { RATING_LABELS } from '../service-provider-labels';

export interface ProviderRatingProps {
  /** `null` quando o prestador ainda nao foi avaliado. */
  value: number | null;
}

/**
 * A avaliacao apresentada como avaliacao, e nao como o inteiro guardado.
 *
 * As estrelas sao decorativas — quem le por leitor de tela recebe a nota com a
 * escala junto ("4 de 5 — Muito bom"), que e o que um `4` solto nao diz.
 */
export function ProviderRating({ value }: ProviderRatingProps) {
  if (value === null) return <span className="text-muted-foreground">—</span>;

  const scale = RATING_LABELS[value];
  // A coluna e um `int` sem restricao de faixa: quem segura o 1 a 5 e o schema
  // da API, entao um registro antigo pode trazer outra coisa. `repeat` de
  // numero negativo levanta excecao, e derrubar a listagem inteira por uma nota
  // torta seria pior do que mostra-la truncada — o rotulo diz o valor de fato.
  const filled = Math.min(Math.max(Math.round(value), 0), 5);

  return (
    <span aria-label={scale ? `${value} de 5 — ${scale}` : `${value} de 5`} className="text-warning">
      <span aria-hidden="true">
        {'★'.repeat(filled)}
        <span className="text-muted-foreground">{'☆'.repeat(5 - filled)}</span>
      </span>
    </span>
  );
}
