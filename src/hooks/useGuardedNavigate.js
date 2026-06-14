import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigationGuard } from '@/lib/navigationGuard';

/**
 * Drop-in replacement for useNavigate() for programmatic navigation
 * (logout, back button, etc.) that respects the unsaved-changes guard.
 */
export function useGuardedNavigate() {
  const navigate = useNavigate();
  return useCallback((to, opts) => {
    const intercepted = navigationGuard.intercept(() => navigate(to, opts));
    if (!intercepted) navigate(to, opts);
  }, [navigate]);
}
