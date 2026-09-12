import { useContext } from 'react';
import { CondominiumContext, type CondominiumContextValue } from '@/providers/condominium-context';

export function useCondominium(): CondominiumContextValue {
  const context = useContext(CondominiumContext);
  if (!context) throw new Error('useCondominium precisa estar dentro de <CondominiumProvider>.');
  return context;
}
