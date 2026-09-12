import { createContext } from 'react';
import type { Condominium } from '@/types/api';

export type CondominiumContextValue = {
  condominiums: Condominium[];
  selected: Condominium | null;
  selectedId: string | null;
  select: (id: string) => void;
  isLoading: boolean;
};

export const CondominiumContext = createContext<CondominiumContextValue | null>(null);
