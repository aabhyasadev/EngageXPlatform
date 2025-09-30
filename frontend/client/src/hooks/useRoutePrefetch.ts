import { useCallback } from 'react';

// Hook for prefetching route chunks on hover/focus
export const useRoutePrefetch = () => {
  const prefetchRoute = useCallback((routeName: string) => {
    const routeMap: Record<string, () => Promise<any>> = {
      analytics: () => import('@/pages/analytics'),
      campaigns: () => import('@/pages/campaigns'),
      contacts: () => import('@/pages/contacts'),
      templates: () => import('@/pages/templates'),
      domains: () => import('@/pages/domains'),
      team: () => import('@/pages/team'),
      settings: () => import('@/pages/settings'),
      subscription: () => import('@/pages/subscription'),
    };

    const importFn = routeMap[routeName];
    if (importFn) {
      // Start prefetching the chunk
      importFn().catch(() => {
        // Silently handle prefetch errors
      });
    }
  }, []);

  return { prefetchRoute };
};