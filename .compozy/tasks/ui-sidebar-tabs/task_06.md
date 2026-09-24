# Task 06: Integrar ButtonTabs no Financeiro

**Type:** frontend
**Wave:** 2
**Dependencies:** task_05
**Status:** completed

---

## Objetivo

Substituir o alternador de seções manual do módulo financeiro pelo componente `ButtonTabs`.

## Escopo

### Arquivo a modificar

- `frontend/src/features/financial/financial-page.tsx`

### Implementação Atual (atual)

```tsx
<nav aria-label="Seções do financeiro" className="flex flex-wrap gap-2">
  {visibleSections.map((item) => {
    const isActive = section === item.id;
    return (
      <Button
        key={item.id}
        type="button"
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        aria-current={isActive ? 'page' : undefined}
        className={cn(isActive && 'pointer-events-none')}
        onClick={() => setSection(item.id)}
      >
        {item.label}
      </Button>
    );
  })}
</nav>
```

### Implementação Nova

```tsx
import { ButtonTabs, ButtonTabsList, ButtonTabsTrigger } from '@/components/ui/button-tabs';

// Substituir o <nav> por:
<ButtonTabs value={section} onValueChange={(v) => setSection(v as SectionId)}>
  <ButtonTabsList variant="buttons">
    {visibleSections.map((item) => (
      <ButtonTabsTrigger key={item.id} value={item.id}>
        {item.label}
      </ButtonTabsTrigger>
    ))}
  </ButtonTabsList>
</ButtonTabs>
```

### Notas

- O `variant="buttons"` mantém o estilo pill/outline atual.
- O `ButtonTabsTrigger` já aplica `data-[state=active]` corretamente.
- Remover a lógica manual de `isActive` e `pointer-events-none`.
- Manter o `aria-label` na `ButtonTabsList`.

## Critérios de aceitação

- [ ] Seções do financeiro usam `ButtonTabs`
- [ ] Alternância entre seções funciona igual ao antes
- [ ] Aparência visual mantida (ou melhorada)
- [ ] Acessibilidade mantida
- [ ] Sem regressão no comportamento existente
- [ ] Import do `ButtonTabs` adicionado

## Notas

- Esta task é uma refatoração simples — não muda comportamento, apenas reusa componente.
- Outras pages que usam alternadores manuais podem ser migradas futuramente.
