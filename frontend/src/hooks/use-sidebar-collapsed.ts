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
      // localStorage indisponivel — ignora silenciosamente.
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  return { collapsed, toggle, setCollapsed };
}
