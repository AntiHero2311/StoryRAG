import { useState, useEffect } from 'react';

type MediaQuery = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpoints: Record<MediaQuery, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export function useMediaQuery(query: MediaQuery): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${breakpoints[query]}px)`);
    
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return !useMediaQuery('md');
}

export function useIsTablet(): boolean {
  const isMd = useMediaQuery('md');
  const isLg = useMediaQuery('lg');
  return isMd && !isLg;
}

export function useIsDesktop(): boolean {
  return useMediaQuery('lg');
}
