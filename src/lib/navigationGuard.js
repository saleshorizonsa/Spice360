// Module-level singleton that tracks dirty forms and routes interception
// to a dialog shown by NavigationGuardProvider.

let dirtyChecker = null;
let dialogHandler = null;

export const navigationGuard = {
  /** Called by useUnsavedChangesWarning — always overwrites with latest isDirty closure */
  register(fn) { dirtyChecker = fn; },
  unregister() { dirtyChecker = null; },
  isDirty() { return dirtyChecker?.() ?? false; },

  /** Called by NavigationGuardProvider on mount */
  setDialogHandler(fn) { dialogHandler = fn; },
  clearDialogHandler() { dialogHandler = null; },

  /**
   * If dirty, stores proceedFn and shows the dialog (returns true).
   * Otherwise returns false so caller can proceed immediately.
   */
  intercept(proceedFn) {
    if (dirtyChecker?.()) {
      dialogHandler?.(proceedFn);
      return true;
    }
    return false;
  },
};
