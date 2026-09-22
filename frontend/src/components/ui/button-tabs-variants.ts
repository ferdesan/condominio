import { cva, type VariantProps } from 'class-variance-authority';

export const buttonTabsListVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-lg p-1 overflow-x-auto scrollbar-none',
  {
    variants: {
      variant: {
        buttons: 'bg-muted px-1 sm:rounded-full',
        pills: 'bg-transparent',
        underline: 'bg-transparent border-b border-border',
      },
    },
    defaultVariants: {
      variant: 'buttons',
    },
  },
);

export const buttonTabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        buttons: [
          // Mobile: o ícone vira badge verde do sistema (mesmo do `Badge`
          // default — `bg-primary/10 text-primary`), com o ativo em verde cheio
          // para não sumir na trilho `bg-muted`.
          'rounded-full bg-primary/10 text-primary',
          'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
          // Desktop: cada aba é um botão pílula visível (não só a barra),
          // com fundo próprio e o ativo em destaque.
          'sm:bg-background/70 sm:text-foreground sm:shadow-sm sm:hover:bg-background',
          'sm:data-[state=active]:bg-background sm:data-[state=active]:text-foreground',
          'sm:data-[state=active]:shadow-md',
        ].join(' '),
        pills: 'data-[state=active]:bg-muted data-[state=active]:text-foreground',
        underline: [
          'rounded-none border-b-2 border-transparent px-4 py-2',
          'data-[state=active]:border-primary data-[state=active]:text-foreground',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'buttons',
    },
  },
);

export type ButtonTabsVariant = VariantProps<typeof buttonTabsListVariants>['variant'];
