import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChangesWarning(isDirty) {
  // Callback form is required — passing a raw boolean doesn't reliably
  // trigger the blocker when navigating between routes in the same router.
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty]
  );

  const blocker = useBlocker(shouldBlock);

  // Native browser dialog for tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [isDirty]);

  // Reset a stuck blocker when the form becomes clean (e.g. after save)
  useEffect(() => {
    if (!isDirty && blocker.state === 'blocked') blocker.reset?.();
  }, [isDirty, blocker]);

  const confirm = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const cancel = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return { isBlocked: blocker.state === 'blocked', confirm, cancel };
}
