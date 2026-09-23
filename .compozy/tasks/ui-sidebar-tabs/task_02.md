# Task 02: Sidebar Colapsável

**Type:** frontend
**Wave:** 2
**Dependencies:** task_01
**Status:** completed

---

## Objetivo

Modificar o componente `Sidebar` para suportar modo colapsado (apenas ícones, `w-16`) além do modo expandido atual (`w-72`).

## Escopo

### Arquivos a modificar

- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/components/layout/app-shell.tsx` (passar prop `collapsed`)

### Comportamento

#### Modo Expandido (atual, `collapsed=false`)
- Largura: `w-72` (288px)
- Itens com ícone + label
- Seções com título visível
- Header com logo/nome completo

#### Modo Colapsado (`collapsed=true`)
- Largura: `w-16` (64px)
- Itens com apenas ícone centralizado
- Seções sem título (separador visual de 8px)
- Header com ícone ou sigla (ex: "CS" de Condomínio SaaS)
- Labels ocultos via `hidden lg:block` ou `sr-only`

### Props da Sidebar

```ts
interface SidebarProps {
  open: boolean;        // controle mobile (drawer)
  collapsed: boolean;   // controle desktop (colapso)
  onClose: () => void;  // fecha drawer mobile
}
```

### Mudanças CSS

```tsx
// Largura condicional
className={cn(
  'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out',
  'lg:static lg:z-auto',
  collapsed ? 'w-16' : 'w-72',
  open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
)}
```

### Itens da navegação

Cada item `NavItem` no modo colapsado:

```tsx
// Label: oculto no colapsado
<span className={cn('transition-opacity', collapsed ? 'hidden' : 'block')}>
  {item.label}
</span>

// Ícone: sempre visível, centralizado
<item.icon className="h-5 w-5 shrink-0" />
```

### Header do sidebar

- **Expandido:** Logo + nome "Condomínio SaaS"
- **Colapsado:** Ícone do logo ou sigla "CS" centralizada

### Seções

- **Expandido:** Título da seção visível (ex: "Estrutura")
- **Colapsado:** Título oculto, separador visual de 8px com `border-t border-border mx-3 my-2`

### AppShell

```tsx
// app-shell.tsx
const { collapsed } = useSidebarCollapsed();

return (
  <div className="flex min-h-svh bg-background">
    <Sidebar open={menuOpen} collapsed={collapsed} onClose={() => setMenuOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar onOpenMenu={() => setMenuOpen(true)} collapsed={collapsed} onToggleCollapse={toggle} />
      ...
    </div>
  </div>
);
```

## Critérios de aceitação

- [ ] Sidebar alterna entre `w-72` e `w-16`
- [ ] Labels são ocultados no modo colapsado
- [ ] Ícones ficam centralizados no modo colapsado
- [ ] Seções mostram separador visual no modo colapsado
- [ ] Header muda entre logo completo e sigla
- [ ] Transição animada com `transition-all duration-200`
- [ ] Mobile não é afetado (continua drawer)
- [ ] Overflow hidden durante transição

## Notas

- Usar `cn()` do `@/lib/utils` para classes condicionais.
- Manter `aria-label` em todos os botões/links.
- O `min-w-0` no conteúdo principal já previne overflow.
