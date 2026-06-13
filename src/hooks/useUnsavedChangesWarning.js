import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChangesWarning(isDirty) {
  const blocker = useBlocker(isDirty);

  // Native browser dialog for tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [isDirty]);

  // Reset the blocker if it gets stuck after isDirty clears
  useEffect(() => {
    if (!isDirty && blocker.state === 'blocked') blocker.reset();
  }, [isDirty, blocker]);

  const confirm = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const cancel = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return { isBlocked: blocker.state === 'blocked', confirm, cancel };
}
