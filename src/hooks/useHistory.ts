import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

interface HistoryState {
  entries: string[];
  index: number;
}

const INITIAL: HistoryState = { entries: [], index: -1 };

export function useHistory() {
  const [hist, setHist] = useState<HistoryState>(INITIAL);

  const pushToHistory = useCallback((content: string) => {
    setHist(prev => {
      if (prev.index >= 0 && prev.entries[prev.index] === content) return prev;
      const sliced = prev.entries.slice(0, prev.index + 1);
      const entries = [...sliced, content];
      if (entries.length > MAX_HISTORY) entries.splice(0, entries.length - MAX_HISTORY);
      return { entries, index: entries.length - 1 };
    });
  }, []);

  const resetHistory = useCallback(() => {
    setHist(INITIAL);
  }, []);

  const setHistoryIndex = useCallback((index: number) => {
    setHist(prev => ({ ...prev, index }));
  }, []);

  return {
    history: hist.entries,
    historyIndex: hist.index,
    setHistoryIndex,
    pushToHistory,
    resetHistory,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.entries.length - 1,
  };
}
