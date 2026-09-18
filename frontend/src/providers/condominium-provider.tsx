import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGetPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import type { Condominium } from '@/types/api';
import { CondominiumContext, type CondominiumContextValue } from './condominium-context';

const STORAGE_KEY = 'condomínio.selectedCondominium';

/**
 * Quase toda tela opera sobre um condominio: o dashboard, por exemplo, exige
 * `condominiumId` na query. A escolha fica aqui e persiste entre sessoes.
 */
export function CondominiumProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, can } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['condominiums', 'options'],
    queryFn: () => apiGetPaginated<Condominium>('/condominiums', { params: { perPage: 100 } }),
    enabled: isAuthenticated && can('condominium:read'),
    staleTime: 5 * 60_000,
  });

  const condominiums = useMemo(() => data?.data ?? [], [data]);

  // Reconcilia a escolha guardada com o que o usuario realmente pode ver.
  useEffect(() => {
    if (condominiums.length === 0) return;
    const stillValid = selectedId && condominiums.some((item) => item.id === selectedId);
    if (stillValid) return;

    const next = condominiums[0].id;
    setSelectedId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem persistencia: a escolha vale apenas para esta sessao.
    }
  }, [condominiums, selectedId]);

  const value = useMemo<CondominiumContextValue>(() => {
    const select = (id: string): void => {
      setSelectedId(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // idem acima.
      }
    };

    return {
      condominiums,
      selected: condominiums.find((item) => item.id === selectedId) ?? null,
      selectedId,
      select,
      isLoading,
    };
  }, [condominiums, selectedId, isLoading]);

  return <CondominiumContext.Provider value={value}>{children}</CondominiumContext.Provider>;
}
