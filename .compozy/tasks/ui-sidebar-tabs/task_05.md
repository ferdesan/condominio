# Task 05: Componente `ButtonTabs`

**Type:** frontend
**Wave:** 1
**Dependencies:** nenhuma
**Status:** pending

---

## Objetivo

Criar o componente `ButtonTabs` — uma variante visual de tabs que usa estilo de botões, construído sobre `@radix-ui/react-tabs`.

## Escopo

### Arquivos a criar

- `frontend/src/components/ui/button-tabs.tsx`
- `frontend/src/components/ui/button-tabs-variants.ts`

### Arquivo a modificar

- `frontend/src/components/ui/index.ts` (adicionar exports)

### API do Componente

```tsx
import {
  ButtonTabs,
  ButtonTabsList,
  ButtonTabsTrigger,
  ButtonTabsContent,
} from '@/components/ui/button-tabs';

<ButtonTabs value={section} onValueChange={setSection}>
  <ButtonTabsList>
    <ButtonTabsTrigger value="charges">Cobranças</ButtonTabsTrigger>
    <ButtonTabsTrigger value="expenses">Despesas</ButtonTabsTrigger>
  </ButtonTabsList>
  <ButtonTabsContent value="charges">
    <ChargesSection />
  </ButtonTabsContent>
  <ButtonTabsContent value="expenses">
    <ExpensesSection />
  </ButtonTabsContent>
</ButtonTabs>
```

### Variantes

```ts
// button-tabs-variants.ts
import { cva } from 'class-variance-authority';

export const buttonTabsListVariants = cva(
  'inline-flex items-center gap-1 rounded-lg p-1',
  {
    variants: {
      variant: {
        buttons: 'bg-muted',
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
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        buttons: [
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        ].join(' '),
        pills: [
          'data-[state=active]:bg-muted data-[state=active]:text-foreground',
        ].join(' '),
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
```

### Implementação

```tsx
// button-tabs.tsx
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { buttonTabsListVariants, buttonTabsTriggerVariants } from './button-tabs-variants';

const ButtonTabs = TabsPrimitive.Root;

const ButtonTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: 'buttons' | 'pills' | 'underline';
  }
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(buttonTabsListVariants({ variant }), className)}
    {...props}
  />
));
ButtonTabsList.displayName = TabsPrimitive.List.displayName;

const ButtonTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: 'buttons' | 'pills' | 'underline';
  }
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(buttonTabsTriggerVariants({ variant }), className)}
    {...props}
  />
));
ButtonTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const ButtonTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  />
));
ButtonTabsContent.displayName = TabsPrimitive.Content.displayName;

export { ButtonTabs, ButtonTabsList, ButtonTabsTrigger, ButtonTabsContent };
```

## Critérios de aceitação

- [ ] 4 componentes exportados: `ButtonTabs`, `ButtonTabsList`, `ButtonTabsTrigger`, `ButtonTabsContent`
- [ ] 3 variantes funcionais: `buttons`, `pills`, `underline`
- [ ] Acessibilidade herdada do Radix (keyboard nav, ARIA)
- [ ] Props `value` e `onValueChange` funcionam
- [ ] Estilo consistente com o design system existente
- [ ] Exportado no `components/ui/index.ts`
- [ ] TypeScript types corretos

## Notas

- Seguir o padrão de `forwardRef` dos demais componentes UI.
- Usar `cn()` para merge de classes.
- Variante `buttons` é o padrão (igual ao estilo pill atual do financeiro).
