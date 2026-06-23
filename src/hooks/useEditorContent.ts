import React, { useState, useRef, useEffect, useCallback } from 'react';
import { STORAGE_KEY, getScrollParent, safeSetItem } from '../utils/editorUtils';
import { sanitizeHtml } from '../utils/sanitize';

interface UseEditorContentProps {
  pushToHistory: (content: string) => void;
}

export function useEditorContent({ pushToHistory }: UseEditorContentProps) {
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const [lineHeight, setLineHeight] = useState(1.7);

  const editorRef = useRef<HTMLDivElement>(null);
  const isResettingRef = useRef(false);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCurrentHtml = useCallback(() => {
    return editorRef.current ? editorRef.current.innerHTML : (generatedHtml || '');
  }, [generatedHtml]);

  const getCleanHtml = useCallback(() => {
    if (!editorRef.current) return generatedHtml || '';
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.ai-edit-trigger').forEach(b => b.remove());
    clone.querySelectorAll('.table-sparkle-bar').forEach(bar => bar.remove());
    clone.querySelectorAll('.table-extend-bar').forEach(bar => bar.remove());
    clone.querySelectorAll('[data-table-id]').forEach(el => el.removeAttribute('data-table-id'));
    clone.querySelectorAll('tfoot.table-extend-tfoot').forEach(tf => tf.remove());
    clone.querySelectorAll('caption.empty-caption').forEach(c => c.remove());
    clone.querySelectorAll('[data-edit-id]').forEach(el => el.removeAttribute('data-edit-id'));
    clone.querySelectorAll('font').forEach(font => {
      const span = document.createElement('span');
      span.innerHTML = font.innerHTML;
      if (font.getAttribute('style')) span.setAttribute('style', font.getAttribute('style')!);
      font.replaceWith(span);
    });
    return clone.innerHTML;
  }, [generatedHtml]);

  const saveToStorage = useCallback(() => {
    if (isResettingRef.current) return;
    const content = getCleanHtml();
    if (content) safeSetItem(STORAGE_KEY, content);
    return content;
  }, [getCleanHtml]);

  // Load saved draft on mount — strip any editing-mode artifacts left in storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const temp = document.createElement('div');
      temp.innerHTML = saved;
      temp.querySelectorAll('.ai-edit-trigger').forEach(b => b.remove());
      temp.querySelectorAll('.table-sparkle-bar').forEach(bar => bar.remove());
      temp.querySelectorAll('.table-extend-bar').forEach(bar => bar.remove());
      temp.querySelectorAll('[data-table-id]').forEach(el => el.removeAttribute('data-table-id'));
      temp.querySelectorAll('tfoot.table-extend-tfoot').forEach(tf => tf.remove());
      temp.querySelectorAll('caption.empty-caption').forEach(c => c.remove());
      temp.querySelectorAll('[data-edit-id]').forEach(el => el.removeAttribute('data-edit-id'));
      const clean = temp.innerHTML;
      setGeneratedHtml(clean);
      pushToHistory(clean);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync DOM with state (without disrupting cursor during typing).
  // Preserve the scroll position so incremental updates (e.g. PDF page-by-page
  // translation) don't jump the viewport back to the top on every chunk.
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === (generatedHtml || '')) return;
    const scrollEl = getScrollParent(editorRef.current);
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    editorRef.current.innerHTML = generatedHtml || '';
    if (scrollEl) scrollEl.scrollTop = savedScroll;
  }, [generatedHtml]);

  // Auto-save on tab-switch, page hide, and every 5s while editing
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveToStorage(); };
    const intervalId = setInterval(() => { if (isEditing) saveToStorage(); }, 5000);
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveToStorage);
    window.addEventListener('beforeunload', saveToStorage);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveToStorage);
      window.removeEventListener('beforeunload', saveToStorage);
      clearInterval(intervalId);
    };
  }, [saveToStorage, isEditing]);

  const cancelPendingHistoryPush = useCallback(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
  }, []);

  const handleEditorInput = useCallback(() => {
    if (isResettingRef.current) return;
    cancelPendingHistoryPush();
    historyTimeoutRef.current = setTimeout(() => {
      if (isResettingRef.current) return;
      const raw = editorRef.current ? editorRef.current.innerHTML : '';
      setGeneratedHtml(prev => {
        if (raw !== prev) {
          pushToHistory(raw);
          if (!isResettingRef.current) safeSetItem(STORAGE_KEY, raw);
          return raw;
        }
        return prev;
      });
    }, 800);
  }, [pushToHistory, cancelPendingHistoryPush]);

  const handleEditorBlur = useCallback(() => {
    if (isResettingRef.current) return;
    if (editorRef.current) setGeneratedHtml(editorRef.current.innerHTML);
  }, []);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const parentEl = selection.anchorNode?.parentElement;
      if (!parentEl) return;
      const currentSize = parseFloat(window.getComputedStyle(parentEl).fontSize);
      const change = (e.key === '=' || e.key === '+') ? 2 : -2;
      const newSize = Math.max(8, currentSize + change);
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontSize', false, '7');
      editorRef.current?.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        (el as HTMLElement).style.fontSize = `${newSize}px`;
      });
      handleEditorInput();
    }
  }, [handleEditorInput]);

  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;

    // Handle image paste
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target?.result as string;
            if (!dataUrl || !editorRef.current) return;
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            img.style.margin = '8px 0';
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } else {
              editorRef.current.appendChild(img);
            }
            handleEditorInput();
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }

    // Sanitize HTML paste — strip scripts/event-handlers while keeping structure
    const htmlData = e.clipboardData?.getData('text/html');
    if (htmlData) {
      e.preventDefault();
      const safe = sanitizeHtml(htmlData);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(safe);
        range.insertNode(fragment);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        handleEditorInput();
      }
    }
  }, [handleEditorInput]);

  const handleZoomIn = useCallback(() => setFontSize(p => Math.min(p + 1, 18)), []);
  const handleZoomOut = useCallback(() => setFontSize(p => Math.max(p - 1, 8)), []);
  const handleLineHeightIncrease = useCallback(() => setLineHeight(p => Math.min(+(p + 0.1).toFixed(1), 2.5)), []);
  const handleLineHeightDecrease = useCallback(() => setLineHeight(p => Math.max(+(p - 0.1).toFixed(1), 1.2)), []);

  return {
    generatedHtml,
    setGeneratedHtml,
    isEditing,
    setIsEditing,
    fontSize,
    lineHeight,
    editorRef,
    isResettingRef,
    getCurrentHtml,
    getCleanHtml,
    saveToStorage,
    cancelPendingHistoryPush,
    handleEditorInput,
    handleEditorBlur,
    handleEditorKeyDown,
    handleEditorPaste,
    handleZoomIn,
    handleZoomOut,
    handleLineHeightIncrease,
    handleLineHeightDecrease,
  };
}
