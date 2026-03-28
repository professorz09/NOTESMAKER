import { useState, useCallback } from 'react';

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
      const entries = prev.entries.slice(0, prev.index + 1);
      return { entries: [...entries, content], index: prev.index + 1 };
    });
  }, []);

  const resetHistory = useCallback(() => {
    setHist(INITIAL);
  }, []);

  return {
    history: hist.entries,
    historyIndex: hist.index,
    setHistoryIndex: (index: number) => setHist(prev => ({ ...prev, index })),
    pushToHistory,
    resetHistory,
    canUndo: hist.index > 0,
    canRedo: hist.index < hist.entries.length - 1,
  };
}
