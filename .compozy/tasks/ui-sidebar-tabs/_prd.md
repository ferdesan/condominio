# PRD: Sidebar Colapsável + Button Tabs

**Slug:** `ui-sidebar-tabs`
**Status:** drafting
**Autor:** Architecture de Software
**Data:** 2026-09-21

---

## Contexto

O sistema atual possui um sidebar fixo de `w-72` (288px) que consome espaço horizontal significativo em telas menores. Além disso, o componente `Tabs` existente (`@radix-ui/react-tabs`) usa estilo pill com fundo `bg-muted`, mas há necessidade de um padrão visual de "button tabs" para seções internas (como o alternador de seções do financeiro).

Duas features complementares são propostas para melhorar a experiência de uso e o espaço de tela.

---

## Feature 1: Sidebar Colapsável

### Problema
- O sidebar ocupa 288px permanentemente, reduzindo a área útil do conteúdo principal.
- Em monitores menores ou durante tarefas focadas (ex: preencher formulários), o espaço desperdiçado é significativo.
- Não há como o usuário controlar a visibilidade do menu.

### Solução
Um botão de toggle no topbar permite alternar entre sidebar expandida (atual) e colapsada (apenas ícones).

### User Stories

| ID | Como... | Quero... | Para... |
|---|---|---|---|
| US-01 | Usuário logado | Clicar num botão no topbar para recolher o sidebar | Ganhar mais espaço de tela |
| US-02 | Usuário logado | Ver o sidebar colapsado com apenas ícones | Navegar rapidamente sem texto |
| US-03 | Usuário logado | Expandir o sidebar de volta ao tamanho normal | Ler os labels dos itens |
| US-04 | Usuário logado | Que a escolha persista entre sessões | Não ter que reconfigurar a cada visita |
| US-05 | Usuário no mobile | Manter o comportamento atual de drawer | Não ser afetado pela feature |

### Requisitos Não-Funcionais

- **Performance:** Transição animada com `transition-all duration-200`.
- **Acessibilidade:** Botão toggle com `aria-label`, `aria-expanded`. Itens colapsados com tooltip ou `title`.
- **Persistência:** Estado salvo em `localStorage` com chave `sidebar-collapsed`.
- **Responsivo:** Feature só ativa no desktop (`lg:`). Mobile continua como drawer.

### Comportamento Detalhado

#### Estado Expandido (atual)
```
┌──────────┬────────────────────────────┐
│ Sidebar  │                            │
│ w-72     │      Conteúdo              │
│          │      (flex-1)              │
│ [ícone]  │                            │
│ Label    │                            │
│          │                            │
└──────────┴────────────────────────────┘
```

#### Estado Colapsado
```
┌──────┬──────────────────────────────┐
│ Side │                              │
│ bar  │       Conteúdo               │
│ w-16 │       (flex-1)               │
│      │                              │
│ [í]  │                              │
│ [í]  │                              │
│ [í]  │                              │
└──────┴──────────────────────────────┘
```

#### Comportamento por breakpoint

| Breakpoint | Comportamento |
|---|---|
| `< lg` (mobile) | Drawer animado (atual), hamburger no topbar |
| `≥ lg` (desktop) | Sidebar inline, toggle de colapso visível |

#### Itens no estado colapsado

- Cada item mostra apenas o ícone centralizado.
- `tooltip` nativo ou componente `Tooltip` aparece no hover.
- Seções com título ficam ocultas (apenas separador visual).
- O header do sidebar (logo/nome) é substituído por um ícone ou sigla.

#### Transição

- Largura: `w-72` ↔ `w-16` com `transition-all duration-200 ease-out`.
- Labels: `opacity-0` → `opacity-100` com `transition-opacity`.
- Overflow: `overflow-hidden` durante a transição para evitar texto quebrado.

### Aceitação

- [ ] Botão de toggle visível no topbar (desktop)
- [ ] Sidebar alterna entre 288px e 64px
- [ ] Ícones centralizados no estado colapsado
- [ ] Tooltips nos itens colapsados
- [ ] Estado persiste em localStorage
- [ ] Mobile não é afetado
- [ ] Transição suave sem flash
- [ ] Acessibilidade (aria-label, aria-expanded)

---

## Feature 2: Button Tabs

### Problema
- O componente `Tabs` atual usa estilo pill com `bg-muted`, que pode não ser adequado para todos os contextos.
- Alternadores de seção (como o do financeiro) usam botões `Button variant="outline/default"` manualmente montados.
- Não há um padrão reutilizável de "button tabs" que combina a semântica de `Tabs` com a aparência de botões.

### Solução
Criar uma variante `ButtonTabs` que encapsula `Tabs` do Radix com estilo de botões, reaproveitando o design system existente.

### User Stories

| ID | Como... | Quero... | Para... |
|---|---|---|---|
| UT-01 | Desenvolvedor | Usar `<ButtonTabs>` como componente reutilizável | Manter consistência visual |
| UT-02 | Desenvolvedor | Configurar variantes (pills, buttons, underline) | Adaptar a diferentes contextos |
| UT-03 | Usuário | Ver a aba ativa claramente diferenciada | Saber onde estou |
| UT-04 | Usuário | Clicar facilmente nas abas | Navegar entre seções |

### Especificação do Componente

```tsx
// Uso proposto
<ButtonTabs value={section} onValueChange={setSection}>
  <ButtonTabsList>
    <ButtonTabsTrigger value="charges">Cobranças</ButtonTabsTrigger>
    <ButtonTabsTrigger value="expenses">Despesas</ButtonTabsTrigger>
    <ButtonTabsTrigger value="categories">Plano de Contas</ButtonTabsTrigger>
  </ButtonTabsList>
  <ButtonTabsContent value="charges">
    <ChargesSection />
  </ButtonTabsContent>
</ButtonTabs>
```

### Variantes

| Variante | Aparência | Uso ideal |
|---|---|---|
| `buttons` (padrão) | Botões com borda, ativo com fundo preenchido | Alternadores de seção |
| `pills` | Botões sem borda, ativo com fundo sutil | Internos de card |
| `underline` | Texto com linha inferior no ativo | Tabs de navegação |

### Estrutura de Arquivos

```
frontend/src/components/ui/
├── button-tabs.tsx          # Novo componente
├── button-tabs-variants.ts  # Variantes via cva
```

### Aceitação

- [ ] Componente `ButtonTabs`, `ButtonTabsList`, `ButtonTabsTrigger`, `ButtonTabsContent`
- [ ] 3 variantes: buttons, pills, underline
- [ ] Acessibilidade herdada do Radix Tabs
- [ ] Consistente com o design system (cores, border-radius, fontes)
- [ ] Documentado com Storybook ou exemplos

---

## ADRs

### ADR-001: Estado do sidebar via localStorage (não Context)

**Decisão:** Usar `localStorage` direto com hook customizado `useSidebarCollapsed()` em vez de React Context.

**Razão:** O estado afeta apenas layout visual, não dados compartilhados. localStorage persiste entre sessões sem precisar de Provider. Se no futuro precisar de Context (ex: sincronizar com backend), a interface do hook não muda.

### ADR-002: Button Tabs como wrapper do Radix Tabs

**Decisão:** Criar `ButtonTabs` como wrapper do `@radix-ui/react-tabs` existente, não um componente independente.

**Razão:** Radix já resolve acessibilidade (keyboard navigation, ARIA roles, focus management). Reimplementar seria duplicação e risco de bugs de acessibilidade.

### ADR-003: Largura colapsada = 64px (w-16)

**Decisão:** Sidebar colapsada terá 64px de largura.

**Razão:** 64px acomoda ícones de 24px com padding de 20px centralizados. É padrão do industry (GitHub, VS Code, Slack). Menos que 48px compromete touch targets no mobile.

---

## Dependências

- `@radix-ui/react-tabs` (já instalado)
- `lucide-react` (já instalado)
- `tailwind-merge` / `cn` (já existe)
- `class-variance-authority` (já existe)

## Fora do Escopo

- Sidebar colapsável no mobile (mantém drawer)
- Drag-and-drop para reordenar itens do sidebar
- Sidebar flutuante (float sobre o conteúdo)
- Animação de largura do conteúdo principal (flex-1 já resolve)

---

## Decisão de Execução

Recomenda-se executar as duas features em sequência via Compozy:

1. **Feature 1 (Sidebar)** → `task_01.md` a `task_04.md`
2. **Feature 2 (Button Tabs)** → `task_05.md` a `task_06.md`

Cada task deve ser implementada, testada individualmente, e commitada antes de avançar.
