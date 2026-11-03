import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatHash, parseHash, type Route } from './url';

export type Navigate = (route: Route, options?: { replace?: boolean }) => void;

/**
 * Fragment routing: works on any static host and under any sub-path, with no server rewrite.
 * Typing in the search box uses replace so the back button is not flooded.
 */
export function useRoute(): [Route, Navigate] {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const route = useMemo(() => parseHash(hash), [hash]);

  const navigate = useCallback<Navigate>((next, options) => {
    const target = formatHash(next);
    if (target === window.location.hash) return;
    if (options?.replace) window.history.replaceState(null, '', target);
    else window.history.pushState(null, '', target);
    setHash(target);
  }, []);

  return [route, navigate];
}
