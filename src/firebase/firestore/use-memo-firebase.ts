'use client';

import { useMemo, DependencyList } from 'react';

/**
 * Hook para estabilizar referências ou queries do Firebase.
 * Evita loops de renderização infinitos ao garantir que o objeto de query/ref
 * só mude se suas dependências realmente mudarem.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
