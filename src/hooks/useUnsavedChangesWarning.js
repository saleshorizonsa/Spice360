import { useEffect, useRef } from 'react';
import { navigationGuard } from '@/lib/navigationGuard';

export function useUnsavedChangesWarning(isDirty) {
    // Updated synchronously during render — no stale-closure window between
    // render and the async useEffect execution.
    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    useEffect(() => {
        // Register once; the closure always reads the latest ref value so the
        // guard sees the current dirty state regardless of when it is checked.
        navigationGuard.register(() => isDirtyRef.current);
        return () => navigationGuard.unregister();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isDirty) return;
        const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handle);
        return () => window.removeEventListener('beforeunload', handle);
    }, [isDirty]);
}
