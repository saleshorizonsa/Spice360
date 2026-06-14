import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigationGuard } from '@/lib/navigationGuard';
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog';

/**
 * Mount once inside the router (wrapping <Outlet> in AuthShell).
 * - Intercepts <Link> anchor clicks in capture phase.
 * - Provides the dialog callback used by useGuardedNavigate.
 */
export function NavigationGuardProvider({ children }) {
  const navigate = useNavigate();
  const [pendingFn, setPendingFn] = useState(null);

  // Register the dialog handler with the singleton
  useEffect(() => {
    navigationGuard.setDialogHandler((fn) => setPendingFn(() => fn));
    return () => navigationGuard.clearDialogHandler();
  }, []);

  // Intercept <Link> / <a> clicks before React Router handles them
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href === window.location.pathname
      ) return;

      const intercepted = navigationGuard.intercept(() => navigate(href));
      if (intercepted) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleClick, true); // capture phase
    return () => document.removeEventListener('click', handleClick, true);
  }, [navigate]);

  const handleLeave = useCallback(() => {
    const fn = pendingFn;
    setPendingFn(null);
    fn?.();
  }, [pendingFn]);

  const handleStay = useCallback(() => setPendingFn(null), []);

  return (
    <>
      {children}
      <UnsavedChangesDialog open={!!pendingFn} onLeave={handleLeave} onStay={handleStay} />
    </>
  );
}
