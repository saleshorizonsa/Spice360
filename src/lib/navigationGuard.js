// Module-level singleton that tracks dirty forms and routes interception
// to a dialog shown by NavigationGuardProvider.

let dirtyChecker = null;
let _persistentDirty = false; // survives component unmount during click→navigate race
let _requestCloseHandler = null; // set by NavigationGuardProvider

export const navigationGuard = {
  /** Called by useUnsavedChangesWarning — always overwrites with latest isDirty closure */
  register(fn) { dirtyChecker = fn; },
  unregister() { dirtyChecker = null; },

  /**
   * Returns true if EITHER the mounted form's ref OR the persistent flag is dirty.
   * The persistent flag handles the race where the dialog unmounts (onInteractOutside)
   * before React Router's useBlocker gets to check.
   */
  isDirty() { return (dirtyChecker?.() ?? false) || _persistentDirty; },

  markDirty()  { _persistentDirty = true;  },
  markClean()  { _persistentDirty = false; },

  /**
   * Called by guardedOpenChange when the user tries to close a dirty form dialog
   * (outside-click, Escape, X button). Routes to the global UnsavedChangesDialog.
   * onConfirmedLeave is called if the user clicks "Leave".
   */
  requestClose(onConfirmedLeave) {
    if (_requestCloseHandler) {
      _requestCloseHandler(onConfirmedLeave);
    }
  },

  setRequestCloseHandler(fn) { _requestCloseHandler = fn; },
  clearRequestCloseHandler() { _requestCloseHandler = null; },
};
