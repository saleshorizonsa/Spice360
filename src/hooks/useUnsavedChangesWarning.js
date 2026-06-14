import { useEffect } from 'react';
import { navigationGuard } from '@/lib/navigationGuard';

export function useUnsavedChangesWarning(isDirty) {
  // Keep the singleton's closure fresh on every render so isDirty is current
  useEffect(() => {
    navigationGuard.register(() => isDirty);
    return () => navigationGuard.unregister();
  });

  // Native browser dialog for tab close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [isDirty]);
}
