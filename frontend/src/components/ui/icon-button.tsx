import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { ICON_BUTTON_SIZE, ICON_BUTTON_TONE, type IconButtonTone } from './icon-button-variants';
import { Tooltip } from './tooltip';

export interface IconButtonProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  'variant' | 'size' | 'children'
> {
  icon: LucideIcon;
  /**
   * O nome acessivel completo, com o registro junto — "Editar bloco A", e nao
   * "Editar". Vira o `aria-label` do botao **e** o texto da tarja, porque os
   * dois precisam dizer a mesma coisa: numa tabela de vinte linhas, um icone
   * repetido vinte vezes so se distingue pelo nome.
   */
  label: string;
  /** Verde por padrao; `destructive` so para a acao que nao tem volta. */
  tone?: IconButtonTone;
}

/**
 * Botao de acao de linha reduzido a um icone.
 *
 * Existe para que a tarja nao seja reescrita em cada uma das dezenas de acoes
 * das tabelas: o `Tooltip` traz `Provider`, `Root`, `Trigger` e `Content`, e
 * repetir esse envelope por botao encheria os arquivos de recurso de estrutura
 * que nao e deles.
 *
 * **O icone nunca e a unica fonte do significado.** O `aria-label` continua
 * carregando o nome completo da acao, como carregava quando o rotulo era
 * visivel — por isso a troca de texto por icone nao mexeu em nenhum teste: eles
 * consultam por papel e nome acessivel, nao pelo texto na tela. O `aria-hidden`
 * no icone evita que o leitor de tela anuncie o glifo alem do rotulo.
 *
 * **Encaminha `ref`** porque o uso natural destes botoes e como gatilho de
 * dialogo (`<DialogTrigger asChild>`), e um componente sem `forwardRef` engole
 * a `ref` do `Slot` do Radix: o gatilho nao posiciona e nao abre, com um aviso
 * do React no console e nada na tela.
 *
 * **A area de toque e 44px abaixo de `sm`** e 36px daqui para cima. A regra de
 * 44px e do proprio projeto (`.touch-target` no `index.css`), e passou a valer
 * aqui porque o alvo encolheu junto com o rotulo: antes era um botao com uma
 * palavra dentro, com quase o dobro da largura.
 */
export const IconButton = React.forwardRef<React.ElementRef<typeof Button>, IconButtonProps>(
  function IconButton({ icon: Icon, label, tone = 'primary', className, ...props }, ref) {
    return (
      <Tooltip label={label}>
        <Button
          ref={ref}
          type="button"
          variant="ghost"
          className={cn(ICON_BUTTON_SIZE, ICON_BUTTON_TONE[tone], className)}
          aria-label={label}
          {...props}
        >
          <Icon aria-hidden="true" />
        </Button>
      </Tooltip>
    );
  },
);
