import { useEffect, useRef } from 'preact/hooks';

export function useGuardHashLinks(isDirtyRef) {
  useEffect(() => {
    const base = location.pathname.startsWith('/unotebook/') ? '/unotebook' : '';

    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;

      const href = a.getAttribute('href');      // e.g. "#/local/foo"
      const path = href.replace(/^#/, '') || '/';

      if (isDirtyRef.current && !confirm('You have unsaved changes. Leave this page?')) {
        e.preventDefault(); e.stopPropagation();
        return;
      }

      // Do the navigation ourselves to keep BASE and fire hashchange
      e.preventDefault();
      const norm = path.startsWith('/') ? path : '/' + path;
      history.pushState(null, '', base + '#' + norm);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      isDirtyRef.current = false
    };

    // Capture phase so we beat any other handlers/default
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}
