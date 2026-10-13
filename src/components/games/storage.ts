// Best scores for the wait-time mini games, kept on this device only.
// Storage can throw (private mode, blocked site data), so every access is guarded.

export const readBest = (key: string): number => {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10) || 0;
  } catch {
    return 0;
  }
};

export const saveBest = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
};

export const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
