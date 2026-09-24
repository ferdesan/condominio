# Task 04: Testes da Sidebar

**Type:** test
**Wave:** 3
**Dependencies:** task_03
**Status:** completed

---

## Objetivo

Escrever testes unitários e de integração para a sidebar colapsável e o hook `useSidebarCollapsed`.

## Escopo

### Arquivos a criar

- `frontend/src/hooks/__tests__/use-sidebar-collapsed.test.ts`
- `frontend/src/components/layout/__tests__/sidebar.test.tsx`
- `frontend/src/components/layout/__tests__/topbar-toggle.test.tsx`

### Casos de teste

#### Hook `useSidebarCollapsed`

| # | Descrição | Esperado |
|---|---|---|
| T-01 | Estado inicial sem localStorage | `collapsed = false` |
| T-02 | Lê valor do localStorage no mount | `collapsed = true` (se salvo) |
| T-03 | `toggle()` inverte o estado | `false → true → false` |
| T-04 | `setCollapsed(true)` define explicitamente | `collapsed = true` |
| T-05 | Persiste mudança no localStorage | `localStorage.setItem` chamado |
| T-06 | Ignora erro de localStorage | Não lança exceção |

#### Sidebar

| # | Descrição | Esperado |
|---|---|---|
| T-07 | Renderiza expanded por padrão | Classe `w-72` presente |
| T-08 | Renderiza collapsed quando prop `collapsed=true` | Classe `w-16` presente |
| T-09 | Labels visíveis no modo expanded | Texto do label no DOM |
| T-10 | Labels ocultos no modo collapsed | Label com `hidden` ou ausente |
| T-11 | Ícones sempre visíveis | Todos os ícones renderizados |
| T-12 | Mobile: drawer abre com `open=true` | `translate-x-0` |
| T-13 | Mobile: drawer fecha com `open=false` | `-translate-x-full` |

#### Topbar Toggle

| # | Descrição | Esperado |
|---|---|---|
| T-14 | Botão toggle visível no desktop | Classe `lg:flex` |
| T-15 | Botão toggle oculto no mobile | Classe `hidden` |
| T-16 | Chama `onToggleCollapse` ao clicar | Callback chamado |
| T-17 | `aria-label` muda conforme estado | Expandido/Recolhido |
| T-18 | `aria-expanded` reflete estado | `true`/`false` |

## Configuração de teste

```ts
// Antes de cada teste
beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});
```

## Critérios de aceitação

- [ ] Todos os 18 casos de teste passam
- [ ] Cobertura do hook: 100% branches
- [ ] Testes rodam em < 5 segundos
- [ ] Sem dependência de rede ou APIs externas
