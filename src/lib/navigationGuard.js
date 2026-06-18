// Module-level singleton that tracks dirty-form state for NavigationGuardProvider's useBlocker.
// The close-guard signal now travels via a CustomEvent on window (see useUnsavedChangesWarning)
// so this module no longer needs a requestClose handler — no module-level state to reset on HMR.

let dirtyChecker = null;
let _persistentDirty = false;

export const navigationGuard = {
  /** Called by useUnsavedChangesWarning — always overwrites with latest isDirty closure */
  register(fn) { dirtyChecker = fn; },
  unregister() { dirtyChecker = null; },

  /**
   * Returns true if EITHER the mounted form's ref OR the persistent flag is dirty.
   * The persistent flag handles the race where the dialog unmounts before React
   * Router's useBlocker gets to evaluate the condition.
   */
  isDirty() { return (dirtyChecker?.() ?? false) || _persistentDirty; },

  markDirty()  { _persistentDirty = true;  },
  markClean()  { _persistentDirty = false; },
};
