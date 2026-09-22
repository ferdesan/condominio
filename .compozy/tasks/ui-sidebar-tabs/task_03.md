# Task 03: Botão Toggle no Topbar

**Type:** frontend
**Wave:** 3
**Dependencies:** task_02
**Status:** pending

---

## Objetivo

Adicionar um botão de toggle no topbar para alternar o estado de colapso do sidebar (visível apenas no desktop).

## Escopo

### Arquivo a modificar

- `frontend/src/components/layout/topbar.tsx`

### Comportamento

#### Botão de toggle (desktop)

- **Posição:** Ao lado do botão hamburger (que é mobile-only) ou no canto esquerdo do topbar.
- **Ícone:** `PanelLeftClose` quando expandido, `PanelLeftOpen` quando colapsado (de `lucide-react`).
- **Visibilidade:** `hidden lg:flex` (aparece apenas no desktop).
- **Acessibilidade:** `aria-label="Recolher menu"` / `aria-label="Expandir menu"`, `aria-expanded`.

#### Layout do Topbar

```
┌──────────────────────────────────────────────────────┐
│ [☰] [◀] │  Seletor de Condomínio    [🔔] [🌙] [👤] │
│  ↑   ↑   │                                            │
│  │   │   │                                            │
│  │   └── Botão toggle (desktop)                       │
│  └── Hamburger (mobile, lg:hidden)                    │
└──────────────────────────────────────────────────────┘
```

### Props do Topbar

```ts
interface TopbarProps {
  onOpenMenu: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

### Implementação sugerida

```tsx
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

// Dentro do Topbar:
<Button
  variant="ghost"
  size="icon"
  className="hidden lg:flex"
  onClick={onToggleCollapse}
  aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
  aria-expanded={!collapsed}
>
  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
</Button>
```

## Critérios de aceitação

- [ ] Botão toggle visível apenas no desktop (`lg:`)
- [ ] Ícone muda conforme estado (close/open)
- [ ] `aria-label` e `aria-expanded` corretos
- [ ] Alinhado com os demais botões do topbar
- [ ] Não afeta o botão hamburger mobile

## Notas

- `PanelLeftClose` e `PanelLeftOpen` são ícones nativos do lucide-react.
- Alternativa: `ChevronsLeft` / `ChevronsRight` se preferir setas.
