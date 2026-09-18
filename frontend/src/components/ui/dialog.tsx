import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 transition-opacity',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /**
   * `right` ancora o dialogo na borda direita, em altura cheia — a forma dos
   * formularios longos, que assim nao disputam o centro da tela com a listagem
   * que ficou atras.
   */
  side?: 'center' | 'right';
  /**
   * `false` fecha somente pelo botao: clique fora e `Escape` param de fechar.
   *
   * Use com criterio. `Escape` e o caminho que quem navega por teclado espera, e
   * desliga-lo prende essa pessoa no dialogo — vale para um formulario longo,
   * onde o clique fora acidental custa o preenchimento, e nao para uma
   * confirmacao curta.
   */
  dismissible?: boolean;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, side = 'center', dismissible = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onInteractOutside={dismissible ? undefined : (event) => event.preventDefault()}
      onEscapeKeyDown={dismissible ? undefined : (event) => event.preventDefault()}
      className={cn(
        // `overflow-hidden` para que o conteudo respeite o canto arredondado; a
        // rolagem mora na regiao de dentro, e nao aqui.
        'fixed z-50 flex flex-col overflow-hidden border-border bg-card shadow-lg duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        side === 'center' && [
          // O teto de altura e o que impede o dialogo de crescer para fora da
          // tela. Centralizado por `-translate-y-1/2`, o excedente sai pelos dois
          // lados, e a parte de cima fica inalcancavel: o Radix trava a rolagem
          // do corpo enquanto o modal esta aberto. `dvh` porque no celular a
          // barra do navegador entra e sai da conta.
          'left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        ],
        side === 'right' && [
          'inset-y-0 right-0 h-full w-full max-w-xl border-l',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        ],
        className,
      )}
      {...props}
    >
      {/*
        A rolagem e de uma regiao so, e ela nao inclui o botao de fechar: rolar
        ate o fim de uma entrada longa nao pode custar a saida. `min-h-0` porque
        um item de flex se recusa a encolher abaixo do proprio conteudo sem ele —
        e sem encolher, nao rola.
      */}
      <div
        className={cn(
          'min-h-0 flex-auto gap-4 overflow-y-auto p-6',
          side === 'center' ? 'grid' : 'flex flex-col',
        )}
      >
        {children}
      </div>
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm bg-card opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-end gap-2', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
