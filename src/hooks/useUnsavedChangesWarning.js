import { useEffect, useRef, useCallback } from 'react';
import { navigationGuard } from '@/lib/navigationGuard';

const GUARD_CLOSE_EVENT = 'unsaved-guard-close';

/**
 * Registers this form with the NavigationGuardProvider so that:
 *  1. Navigating away (React Router) while dirty shows a Stay / Leave prompt.
 *  2. Closing the form dialog (X button, Escape, outside-click, Cancel button)
 *     while dirty shows the same prompt via a CustomEvent dispatched on window.
 *
 * Returns an object:
 *   guardedOpenChange(onClose) → handler for Dialog's onOpenChange prop
 *   guardedClose(onClose)      → handler for a Cancel button's onClick prop
 *
 * NavigationGuardProvider listens for GUARD_CLOSE_EVENT and shows
 * UnsavedChangesDialog when it fires.
 */
export function useUnsavedChangesWarning(isDirty) {
    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    // Keep the module-level persistent flag in sync so useBlocker sees the state
    // even during the click→navigate race where the component unmounts first.
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
            navigationGuard.markClean();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Browser "are you sure?" on tab/window close
    useEffect(() => {
        if (!isDirty) return;
        const handle = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handle);
        return () => window.removeEventListener('beforeunload', handle);
    }, [isDirty]);

    // Fires a CustomEvent so NavigationGuardProvider can show UnsavedChangesDialog.
    // Using CustomEvent (window) is HMR-proof: window survives module hot-reload,
    // so the provider's addEventListener always receives the event regardless of
    // whether Vite has re-executed navigationGuard.js.
    const dispatchGuardClose = useCallback((onClose) => {
        window.dispatchEvent(
            new CustomEvent(GUARD_CLOSE_EVENT, { detail: { onClose } })
        );
    }, []);

    // Wrap Dialog's onOpenChange so clicking X / Escape / outside shows the guard.
    const guardedOpenChange = useCallback(
        (onClose) => (open) => {
            if (!open && isDirtyRef.current) {
                dispatchGuardClose(onClose);
                return; // keep dialog open — provider will show UnsavedChangesDialog
            }
            if (!open) onClose?.();
        },
        [dispatchGuardClose]
    );

    // Wrap a Cancel button's onClick so it also shows the guard when dirty.
    const guardedClose = useCallback((onClose) => () => {
        if (isDirtyRef.current) {
            dispatchGuardClose(onClose);
            return;
        }
        onClose?.();
    }, [dispatchGuardClose]);

    return { guardedOpenChange, guardedClose };
}
