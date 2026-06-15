import React, { useCallback } from 'react';
import { useBlocker } from 'react-router-dom';
import { navigationGuard } from '@/lib/navigationGuard';
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog';

/**
 * Mount once inside the data-router (wrapping <Outlet> in AuthShell).
 * Uses React Router's useBlocker to intercept ALL navigation — Link clicks,
 * programmatic navigate(), and browser back/forward — whenever a form is dirty.
 */
export function NavigationGuardProvider({ children }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      navigationGuard.isDirty() &&
      currentLocation.pathname !== nextLocation.pathname
  );

  const handleLeave = useCallback(() => {
    blocker.proceed?.();
  }, [blocker]);

  const handleStay = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);

  return (
    <>
      {children}
      <UnsavedChangesDialog
        open={blocker.state === 'blocked'}
        onLeave={handleLeave}
        onStay={handleStay}
      />
    </>
  );
}
