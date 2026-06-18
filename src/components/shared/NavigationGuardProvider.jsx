import React, { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { navigationGuard } from '@/lib/navigationGuard';
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog';

const GUARD_CLOSE_EVENT = 'unsaved-guard-close';

/**
 * Mount once inside the data-router (wrapping <Outlet> in AuthShell).
 *
 * Handles two cases:
 *  1. Route navigation (browser back/forward, sidebar Link clicks that reach the router)
 *     — intercepted by useBlocker.
 *  2. Closing a dirty form dialog (X button, Escape, outside-click, Cancel button)
 *     — intercepted by guardedOpenChange / guardedClose in useUnsavedChangesWarning
 *       which dispatch a CustomEvent on window; this provider listens and shows the dialog.
 *
 * Using CustomEvent instead of a module-level callback makes this HMR-proof:
 * window survives Vite hot-reload, so the listener re-registers after every
 * component mount and never goes stale.
 */
export function NavigationGuardProvider({ children }) {
  const [pendingClose, setPendingClose] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      const { onClose } = e.detail ?? {};
      setPendingClose(() => onClose);
    };
    window.addEventListener(GUARD_CLOSE_EVENT, handler);
    return () => window.removeEventListener(GUARD_CLOSE_EVENT, handler);
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
      <UnsavedChangesDialog open={isOpen} onLeave={handleLeave} onStay={handleStay} />
    </>
  );
}
