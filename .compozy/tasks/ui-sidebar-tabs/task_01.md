# Task 01: Hook `useSidebarCollapsed`

**Type:** frontend
**Wave:** 1
**Dependencies:** nenhuma
**Status:** completed

---

## Objetivo

Criar um hook `useSidebarCollapsed` que gerencia o estado de colapso do sidebar com persistência em `localStorage`.

## Escopo

### Arquivos a criar

- `frontend/src/hooks/use-sidebar-collapsed.ts`

### Comportamento

```ts
export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}
```

- **Estado inicial:** `false` (expandido) — lido do `localStorage` na primeira renderização.
- **Chave:** `condominio-sidebar-collapsed`.
- **Persistência:** Salva no `localStorage` a cada mudança.
- **Default:** `false` se não houver valor salvo.
- **SSR-safe:** Usa `useState` com lazy initializer + `useEffect` para sincronizar.

### Implementação sugerida

```ts
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'condominio-sidebar-collapsed';

function readStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage indisponível — ignora silenciosamente.
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  return { collapsed, toggle, setCollapsed };
}
```

## Critérios de aceitação

- [ ] Hook retorna `{ collapsed, toggle, setCollapsed }`
- [ ] Estado inicial vem do `localStorage`
- [ ] Mudanças são persistidas no `localStorage`
- [ ] Funciona sem erros em ambiente sem `localStorage` (SSR, testes)
- [ ] Tipo TypeScript exportado corretamente

## Notas

- Não usar Context — o hook é consumido apenas pelo `AppShell`.
- Se no futuro precisar de Context, a interface do hook não muda.
