import { useEffect, useRef, useCallback } from 'react';
import { navigationGuard } from '@/lib/navigationGuard';

/**
 * Registers this form with the NavigationGuardProvider so that navigating
 * away while dirty shows a Stay / Leave confirmation.
 *
 * Returns `guardedOpenChange` — a helper to wrap a shadcn Dialog's
 * `onOpenChange` prop so the dialog cannot close via outside-click or Escape
 * while dirty.  This keeps the form mounted so useBlocker can fire:
 *
 *   const guardedOpenChange = useUnsavedChangesWarning(isDirty);
 *   <Dialog open={true} onOpenChange={guardedOpenChange(onClose)}>
 */
export function useUnsavedChangesWarning(isDirty) {
    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    // Keep the module-level persistent flag in sync.
    // On unmount the cleanup always clears it so an explicit Cancel button
    // close doesn't leave a dangling flag.  The useBlocker fires before React
    // commits the unmount triggered by onInteractOutside (concurrent mode
    // defers state updates), so the flag is still set when needed.
    useEffect(() => {
        if (isDirty) {
            navigationGuard.markDirty();
        } else {
            navigationGuard.markClean();
        }
    }, [isDirty]);

    useEffect(() => {
        navigationGuard.register(() => isDirtyRef.current);
        return () => {
            navigationGuard.unregister();
            navigationGuard.markClean(); // clear on unmount (Cancel / save path)
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Browser "are you sure you want to leave?" on tab/window close
    useEffect(() => {
        if (!isDirty) return;
        const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handle);
        return () => window.removeEventListener('beforeunload', handle);
    }, [isDirty]);

    /**
     * Wrap a Dialog's onOpenChange so Radix-UI cannot close the dialog via
     * outside-click or Escape while there are unsaved changes.  The navigation
     * guard (useBlocker) intercepts the navigation instead and shows the
     * Stay / Leave prompt.
     */
    const guardedOpenChange = useCallback(
        (onClose) => (open) => {
            if (!open && isDirtyRef.current) return; // block dialog-level close
            if (!open) onClose?.();
        },
        [] // stable — always reads the live isDirtyRef
    );

    return guardedOpenChange;
}
