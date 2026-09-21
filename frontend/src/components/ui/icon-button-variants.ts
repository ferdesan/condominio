export type IconButtonTone = 'primary' | 'destructive';

/**
 * A tarja atras do icone, no mesmo desenho do `StatCard` do painel: cor cheia
 * no traco, a 10% no fundo. O `destructive` existe porque pintar "Excluir" de
 * verde junto com "Editar" apagaria a unica diferenca visivel entre uma acao
 * reversivel e uma que nao e — e o icone sozinho ja pede mais atencao do que o
 * rotulo pedia.
 */
export const ICON_BUTTON_TONE: Record<IconButtonTone, string> = {
  primary: 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive',
};

/**
 * 44px no toque, 36px no ponteiro. A regra de 44px e do proprio projeto
 * (`.touch-target` no `index.css`) e passou a valer aqui porque o alvo encolheu
 * junto com o rotulo: antes era um botao com uma palavra dentro.
 */
export const ICON_BUTTON_SIZE = 'h-11 w-11 p-0 sm:h-9 sm:w-9';

/**
 * Mora fora de `icon-button.tsx` pela mesma razao que `button-variants.ts` mora
 * fora de `button.tsx`: exportar constante ao lado de componente acende o
 * `only-export-components` do lint. E a acao que **navega** precisa das mesmas
 * classes sem poder usar o componente — uma ancora nao pode virar `button` sem
 * perder "abrir em nova aba" e o endereco na barra de status.
 */
