import React, { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { navigationGuard } from '@/lib/navigationGuard';
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog';

/**
 * Mount once inside the data-router (wrapping <Outlet> in AuthShell).
 *
 * Handles two cases:
 * 1. Route navigation (browser back/forward, sidebar Link clicks that reach the router)
 *    — intercepted by useBlocker.
 * 2. Trying to close a dirty form dialog via outside-click / Escape / X button
 *    — intercepted by guardedOpenChange in useUnsavedChangesWarning, which calls
 *      navigationGuard.requestClose(onConfirmedLeave) to delegate here.
 */
export function NavigationGuardProvider({ children }) {
  // pendingClose is set when guardedOpenChange triggers a close attempt on a dirty form.
  // It holds the onClose callback to call if the user confirms "Leave".
  const [pendingClose, setPendingClose] = useState(null);

  useEffect(() => {
    navigationGuard.setRequestCloseHandler((onConfirmedLeave) => {
      setPendingClose(() => onConfirmedLeave);
    });
    return () => navigationGuard.clearRequestCloseHandler();
  }, []);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      navigationGuard.isDirty() &&
      currentLocation.pathname !== nextLocation.pathname
  );

  const handleLeave = useCallback(() => {
    navigationGuard.markClean();
    if (blocker.state === 'blocked') {
      blocker.proceed?.();
    }
    if (pendingClose) {
      const cb = pendingClose;
      setPendingClose(null);
      cb?.();
    }
  }, [blocker, pendingClose]);

  const handleStay = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset?.();
    }
    setPendingClose(null);
  }, [blocker]);

  const isOpen = blocker.state === 'blocked' || pendingClose !== null;

  return (
    <>
      {children}
      <UnsavedChangesDialog
        open={isOpen}
        onLeave={handleLeave}
        onStay={handleStay}
      />
    </>
  );
}
