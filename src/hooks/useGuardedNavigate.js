import { useNavigate } from 'react-router-dom';

/**
 * Drop-in replacement for useNavigate().
 * Navigation guard is handled globally by NavigationGuardProvider (useBlocker),
 * so no manual interception is needed here.
 */
export function useGuardedNavigate() {
  return useNavigate();
}
