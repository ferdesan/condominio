import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-elevated',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface TooltipProps {
  /** O texto da tarja. */
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

/**
 * Tarja de apoio para um controle que se explica por um icone.
 *
 * **Nao substitui o nome acessivel.** A tarja aparece no ponteiro e no foco,
 * mas nao existe para quem navega por leitor de tela nem para quem toca a tela:
 * o `aria-label` do proprio botao continua sendo obrigatorio. Aqui ela e reforco
 * visual, nunca a unica fonte do significado.
 *
 * Traz o `Provider` junto de proposito. Deixa-lo so na raiz faria cada teste que
 * monta um componente isolado estourar por falta de contexto — e sao muitos.
 */
export function Tooltip({ label, children, side = 'top', delayDuration = 200 }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </TooltipRoot>
    </TooltipPrimitive.Provider>
  );
}
