import { useState, useRef, useEffect, useCallback, type RefObject, type MutableRefObject } from 'react';
import {
  rewriteContent,
  rewriteSection,
  expandSection,
  generateNextContent,
  generateDetailedNextTopic,
  generateSectionImage,
  generateDiagram,
  extendTableRows,
} from '../services/ai';
import { getSectionNodes, extractImagesFromHtml } from '../utils/editorUtils';

type EditTab = 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'diagram' | 'table';

interface UseAIEditProps {
  isEditing: boolean;
  generatedHtml: string | null;
  getCurrentHtml: () => string;
  pushToHistory: (content: string) => void;
  saveToStorage: () => void | string | undefined;
  editorRef: RefObject<HTMLDivElement>;
  isResettingRef: MutableRefObject<boolean>;
  setGeneratedHtml: (html: string | null) => void;
}

export function useAIEdit({
  isEditing,
  generatedHtml,
  getCurrentHtml,
  pushToHistory,
  saveToStorage,
  editorRef,
  isResettingRef,
  setGeneratedHtml,
}: UseAIEditProps) {
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [activeSectionHtml, setActiveSectionHtml] = useState('');
  const [rewriteType, setRewriteType] = useState<'selection' | 'section'>('selection');
  const [editTab, setEditTab] = useState<EditTab>('rewrite');
  const [rewriteModel, setRewriteModel] = useState('gemini-3-flash-preview');

  const selectionRangeRef = useRef<Range | null>(null);
  const activeEditIdRef = useRef<string | null>(null);
  const isTableExtendMode = useRef(false);
  const extendTableRef = useRef<Element | null>(null);
  const extendContextRef = useRef<{ headersHtml: string; lastRowsHtml: string } | null>(null);

  const [isExtendTableOpen, setIsExtendTableOpen] = useState(false);
  const [extendHeadersPreview, setExtendHeadersPreview] = useState('');
  const [modalImages, setModalImages] = useState<{ base64: string; mimeType: string; dataUrl: string }[]>([]);

  // Add/remove AI edit trigger buttons when editing mode changes
  useEffect(() => {
    if (!editorRef.current) return;
    if (isEditing) {
      const elements = editorRef.current.querySelectorAll('h1, h2, h3, h4, li, table, .flowchart-container');
      elements.forEach((el) => {
        if (el.querySelector('.ai-edit-trigger')) return;

        const btn = document.createElement('span');
        btn.contentEditable = 'false';
        btn.className = 'ai-edit-trigger no-print';
        btn.innerHTML = '✨';
        btn.title = 'Rewrite/Expand';

        if (el.tagName === 'TABLE') {
          // ── Top bar: ✨ button inserted BEFORE the table (not inside caption) ──
          const parentEl = el.parentElement;
          if (parentEl && !parentEl.querySelector(`.table-sparkle-bar[data-for="${(el as HTMLElement).dataset.tableId}"]`)) {
            const tableId = `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            (el as HTMLElement).dataset.tableId = tableId;
            const topBar = document.createElement('div');
            topBar.className = 'table-sparkle-bar no-print';
            topBar.contentEditable = 'false';
            topBar.dataset.for = tableId;
            topBar.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:2px;';
            btn.contentEditable = 'false';
            btn.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer;font-size:15px;padding:2px 6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#2563eb;user-select:none;';
            btn.title = 'Edit / Expand this table';
            topBar.appendChild(btn);
            parentEl.insertBefore(topBar, el);
          }

          // ── Bottom bar: Extend Table button inserted AFTER the table (not inside tfoot) ──
          if (!el.nextElementSibling?.classList.contains('table-extend-bar')) {
            const bottomBar = document.createElement('div');
            bottomBar.className = 'table-extend-bar no-print';
            bottomBar.contentEditable = 'false';
            bottomBar.style.cssText = 'display:flex;justify-content:center;margin-top:4px;margin-bottom:12px;';
            const extendBtn = document.createElement('span');
            extendBtn.contentEditable = 'false';
            extendBtn.className = 'ai-edit-trigger table-extend-btn no-print';
            extendBtn.innerHTML = '➕ Extend Table';
            extendBtn.title = 'Add rows or columns';
            extendBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:5px 14px;background:#f0fdf4;border:1px dashed #86efac;border-radius:8px;font-size:12px;color:#15803d;cursor:pointer;font-weight:600;';
            bottomBar.appendChild(extendBtn);
            el.insertAdjacentElement('afterend', bottomBar);
          }
        } else if (el.classList.contains('flowchart-container')) {
          btn.style.cssText = 'position:absolute;right:10px;top:10px;z-index:10;background:#fff;';
          el.appendChild(btn);
        } else if (el.tagName === 'LI') {
          el.insertBefore(btn, el.firstChild);
        } else {
          el.appendChild(btn);
        }
      });
    } else {
      editorRef.current.querySelectorAll('.ai-edit-trigger').forEach(b => b.remove());
      editorRef.current.querySelectorAll('.table-sparkle-bar').forEach(bar => bar.remove());
      editorRef.current.querySelectorAll('.table-extend-bar').forEach(bar => bar.remove());
      editorRef.current.querySelectorAll('[data-table-id]').forEach(el => (el as HTMLElement).removeAttribute('data-table-id'));
      // legacy cleanup
      editorRef.current.querySelectorAll('caption.empty-caption').forEach(cap => cap.remove());
      editorRef.current.querySelectorAll('tfoot.table-extend-tfoot').forEach(tfoot => tfoot.remove());
    }
  }, [isEditing, generatedHtml, editorRef]);

  // Stable section edit handler
  const handleSectionEdit = useCallback((
    startNode: Element,
    defaultTab?: EditTab,
  ) => {
    if (!editorRef.current) return;
    const currentRaw = getCurrentHtml();
    pushToHistory(currentRaw);
    setGeneratedHtml(currentRaw);

    const editId = `edit-${Date.now()}`;
    editorRef.current.querySelectorAll('[data-edit-id]').forEach(el => el.removeAttribute('data-edit-id'));
    startNode.setAttribute('data-edit-id', editId);
    activeEditIdRef.current = editId;

    const nodes = getSectionNodes(startNode);
    const tempDiv = document.createElement('div');
    nodes.forEach(node => {
      const clone = node.cloneNode(true) as Element;
      clone.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
      clone.querySelector('tfoot.table-extend-tfoot')?.remove();
      clone.removeAttribute('data-edit-id');
      tempDiv.appendChild(clone);
    });

    setActiveSectionHtml(tempDiv.innerHTML);
    setGeneratedHtml(editorRef.current.innerHTML);
    setRewriteType('section');
    setEditTab(defaultTab || 'rewrite');
    setRewriteInstruction('');
    setRewriteModalOpen(true);
  }, [getCurrentHtml, pushToHistory, setGeneratedHtml, editorRef]);

  // Extend Table: append new rows to existing table without replacing it
  const handleTableExtend = useCallback((tableEl: Element) => {
    if (!editorRef.current) return;
    const currentRaw = getCurrentHtml();
    pushToHistory(currentRaw);
    setGeneratedHtml(currentRaw);

    // Extract headers HTML (thead inner)
    const thead = tableEl.querySelector('thead');
    const headersHtml = thead ? thead.innerHTML : '';

    // Extract last 2 data rows from tbody
    const tbody = tableEl.querySelector('tbody');
    const allRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    const lastRows = allRows.slice(Math.max(0, allRows.length - 2));
    const lastRowsHtml = lastRows.map(r => {
      const clone = r.cloneNode(true) as Element;
      clone.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
      return clone.outerHTML;
    }).join('');

    // Store reference so we can append rows on submit
    isTableExtendMode.current = true;
    extendTableRef.current = tableEl;
    extendContextRef.current = { headersHtml, lastRowsHtml };

    // Build a plain-text preview of the column headers for the modal UI
    const tempDiv2 = document.createElement('div');
    tempDiv2.innerHTML = headersHtml;
    const headerTexts = Array.from(tempDiv2.querySelectorAll('th'))
      .map(th => th.textContent?.trim())
      .filter(Boolean);
    setExtendHeadersPreview(headerTexts.join(' | ') || 'Table context captured');

    // Keep activeSectionHtml in sync too (for any fallback reads)
    setActiveSectionHtml(JSON.stringify({ headersHtml, lastRowsHtml }));
    setRewriteType('section');
    setEditTab('table');
    setRewriteInstruction('');
    setIsExtendTableOpen(true);
    setRewriteModalOpen(true);
  }, [getCurrentHtml, pushToHistory, setGeneratedHtml, editorRef]);

  // Click listener for AI edit trigger buttons
  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement).closest('.ai-edit-trigger') as HTMLElement;
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();

      // ── Extend table button (now in .table-extend-bar after the table) ──
      if (trigger.classList.contains('table-extend-btn')) {
        const bar = trigger.closest('.table-extend-bar') as HTMLElement;
        // The table is the previous sibling of the bar
        const table = bar?.previousElementSibling as Element;
        if (table?.tagName === 'TABLE') handleTableExtend(table);
        return;
      }

      // ── Sparkle button (now in .table-sparkle-bar before the table) ──
      const sparkleBar = trigger.closest('.table-sparkle-bar') as HTMLElement;
      if (sparkleBar) {
        const tableId = sparkleBar.dataset.for;
        const table = tableId
          ? editorRef.current?.querySelector(`[data-table-id="${tableId}"]`)
          : sparkleBar.nextElementSibling;
        if (table) handleSectionEdit(table as Element);
        return;
      }

      // ── All other elements (headings, li, flowchart-container) ──
      let parent = trigger.parentElement;
      // Legacy caption/tfoot fallback
      if (parent?.tagName === 'CAPTION') parent = parent.parentElement;
      if (parent?.tagName === 'TD' && parent.parentElement?.parentElement?.tagName === 'TFOOT') {
        parent = parent.parentElement!.parentElement!.parentElement;
      }
      if (!parent) return;
      handleSectionEdit(parent);
    };
    const editor = editorRef.current;
    if (editor) editor.addEventListener('click', handleEditorClick);
    return () => { if (editor) editor.removeEventListener('click', handleEditorClick); };
  }, [isEditing, handleSectionEdit, handleTableExtend, editorRef]);

  const openSelectionRewriteModal = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
      alert('Please select text to rewrite.');
      return;
    }
    selectionRangeRef.current = selection.getRangeAt(0);
    setRewriteType('selection');
    setEditTab('rewrite');
    setRewriteInstruction('');
    setRewriteModalOpen(true);
  };

  const handleRewriteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRewriting(true);
    try {
      const rawBefore = getCurrentHtml();
      pushToHistory(rawBefore);
      let resultHtml = '';

      // ── Special path: Extend Table (append rows, do NOT replace the table) ──
      if (isTableExtendMode.current && extendTableRef.current && extendContextRef.current) {
        const tableEl = extendTableRef.current;
        const ctx = extendContextRef.current;
        const newRows = await extendTableRows(ctx.headersHtml, ctx.lastRowsHtml, rewriteInstruction, rewriteModel);

        if (isResettingRef.current) return;
        if (!newRows) throw new Error('No rows generated');

        // Append new <tr> rows to tbody, inserting before the tfoot so extend button stays at bottom
        let tbody = tableEl.querySelector('tbody');
        if (!tbody) {
          tbody = document.createElement('tbody');
          const tfoot = tableEl.querySelector('tfoot');
          tableEl.insertBefore(tbody, tfoot || null);
        }
        const tfoot = tableEl.querySelector('tfoot.table-extend-tfoot');
        const tempDiv = document.createElement('tbody');
        tempDiv.innerHTML = newRows;
        const newTrNodes = Array.from(tempDiv.querySelectorAll('tr'));
        if (tfoot) {
          newTrNodes.forEach(tr => tbody!.insertBefore(tr, null));
        } else {
          newTrNodes.forEach(tr => tbody!.appendChild(tr));
        }

        // Persist & finish — no replace needed
        const updatedHtml = editorRef.current!.innerHTML;
        setGeneratedHtml(updatedHtml);
        localStorage.setItem('ai_book_writer_draft', updatedHtml);
        setRewriteModalOpen(false);
        setModalImages([]);
        isTableExtendMode.current = false;
        extendTableRef.current = null;
        extendContextRef.current = null;
        return;
      }

      const extraImages = modalImages.map(({ base64, mimeType }) => ({ base64, mimeType }));

      if (rewriteType === 'section') {
        const sectionImages = [...extractImagesFromHtml(activeSectionHtml), ...extraImages];
        if (editTab === 'rewrite') resultHtml = await rewriteSection(activeSectionHtml, rewriteInstruction, rewriteModel, sectionImages);
        else if (editTab === 'expand') resultHtml = await expandSection(activeSectionHtml, rewriteInstruction, rewriteModel, sectionImages);
        else if (editTab === 'continue') resultHtml = await generateNextContent(activeSectionHtml, rewriteInstruction, rewriteModel, sectionImages);
        else if (editTab === 'next_topic') resultHtml = await generateDetailedNextTopic(activeSectionHtml, rewriteInstruction, rewriteModel, sectionImages);
        else if (editTab === 'image') resultHtml = activeSectionHtml + await generateSectionImage(activeSectionHtml, rewriteInstruction);
        else if (editTab === 'diagram') resultHtml = activeSectionHtml + await generateDiagram(activeSectionHtml, rewriteInstruction, rewriteModel);
      } else {
        const range = selectionRangeRef.current;
        const selectionHtml = (() => {
          if (!range) return '';
          const div = document.createElement('div');
          div.appendChild(range.cloneContents());
          return div.innerHTML;
        })();
        const selectedText = range?.toString() || '';
        const selectionImages = [...extractImagesFromHtml(selectionHtml), ...extraImages];
        if (editTab === 'rewrite') resultHtml = await rewriteContent(selectedText, rewriteInstruction, rewriteModel, selectionImages);
        else if (editTab === 'expand') resultHtml = await expandSection(selectionHtml || selectedText, rewriteInstruction, rewriteModel, selectionImages);
        else if (editTab === 'continue') resultHtml = selectionHtml + ' ' + await generateNextContent(selectionHtml || selectedText, rewriteInstruction, rewriteModel, selectionImages);
        else if (editTab === 'next_topic') resultHtml = selectionHtml + ' ' + await generateDetailedNextTopic(selectionHtml || selectedText, rewriteInstruction, rewriteModel, selectionImages);
        else if (editTab === 'image') resultHtml = selectedText + '<br/>' + await generateSectionImage(selectedText, rewriteInstruction);
        else if (editTab === 'diagram') resultHtml = selectedText + '<br/>' + await generateDiagram(selectedText, rewriteInstruction, rewriteModel);
      }

      if (isResettingRef.current) return;
      if (!resultHtml) throw new Error('No content generated');

      // ── Safety net for Deep Dive: ensure the original heading is preserved ──
      if (editTab === 'expand' && rewriteType === 'section') {
        const headingMatch = activeSectionHtml.match(/^(\s*<(h[1-4])[^>]*>[\s\S]*?<\/\2>)/i);
        if (headingMatch) {
          const originalHeading = headingMatch[1];
          const headingTag = headingMatch[2]; // e.g. 'h2'
          const startsWithHeading = new RegExp(`^\\s*<${headingTag}[\\s>]`, 'i').test(resultHtml);
          if (!startsWithHeading) {
            resultHtml = originalHeading + '\n' + resultHtml;
          }
        }
      }

      // Replace content in DOM
      if (rewriteType === 'section') {
        const editId = activeEditIdRef.current;
        if (!editorRef.current || !editId) throw new Error('Editor context lost.');
        const startNode = editorRef.current.querySelector(`[data-edit-id="${editId}"]`);
        if (!startNode) throw new Error('Lost position.');
        const nodesToReplace = getSectionNodes(startNode);
        const parent = nodesToReplace[0].parentNode;
        if (!parent) throw new Error('Parent node lost.');
        const range = document.createRange();
        range.setStartBefore(nodesToReplace[0]);
        const fragment = range.createContextualFragment(resultHtml);
        if (editTab === 'continue' || editTab === 'next_topic') {
          const lastNode = nodesToReplace[nodesToReplace.length - 1];
          if (lastNode.nextSibling) parent.insertBefore(fragment, lastNode.nextSibling);
          else parent.appendChild(fragment);
          startNode.removeAttribute('data-edit-id');
        } else {
          // Remove any table editor bars adjacent to nodes being replaced
          nodesToReplace.forEach(n => {
            const prev = n.previousElementSibling;
            const next = n.nextElementSibling;
            if (prev?.classList.contains('table-sparkle-bar')) prev.remove();
            if (next?.classList.contains('table-extend-bar')) next.remove();
          });
          parent.insertBefore(fragment, nodesToReplace[0]);
          nodesToReplace.forEach(n => n.remove());
        }
      } else {
        const range = selectionRangeRef.current;
        if (range) {
          const fragment = range.createContextualFragment(resultHtml);
          range.deleteContents();
          range.insertNode(fragment);
          window.getSelection()?.removeAllRanges();
        }
      }

      setRewriteModalOpen(false);
      setModalImages([]);
      if (editorRef.current) {
        const raw = getCurrentHtml();
        setGeneratedHtml(raw);
        pushToHistory(raw);
        saveToStorage();
      }
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error('Rewrite failed:', error);
        alert(`Rewrite failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      if (!isResettingRef.current) setIsRewriting(false);
      isTableExtendMode.current = false;
      extendTableRef.current = null;
      extendContextRef.current = null;
      setIsExtendTableOpen(false);
    }
  };

  // Remove the currently selected section from the editor
  const handleSectionRemove = useCallback(() => {
    if (!editorRef.current) return;
    const editId = activeEditIdRef.current;
    if (!editId) return;
    const startNode = editorRef.current.querySelector(`[data-edit-id="${editId}"]`);
    if (!startNode) return;
    const nodesToRemove = getSectionNodes(startNode);
    pushToHistory(getCurrentHtml());
    nodesToRemove.forEach(n => n.remove());
    // Also remove adjacent table bars if present
    editorRef.current.querySelectorAll('.table-sparkle-bar, .table-extend-bar').forEach(bar => bar.remove());
    const raw = editorRef.current.innerHTML;
    setGeneratedHtml(raw);
    saveToStorage();
    setRewriteModalOpen(false);
    activeEditIdRef.current = null;
  }, [editorRef, activeEditIdRef, getCurrentHtml, pushToHistory, setGeneratedHtml, saveToStorage]);

  const closeRewriteModal = useCallback(() => {
    setRewriteModalOpen(false);
    setIsExtendTableOpen(false);
    setModalImages([]);
    isTableExtendMode.current = false;
    extendTableRef.current = null;
    extendContextRef.current = null;
  }, []);

  return {
    rewriteModalOpen,
    closeRewriteModal,
    isExtendTableOpen,
    extendHeadersPreview,
    rewriteInstruction, setRewriteInstruction,
    isRewriting,
    activeSectionHtml,
    rewriteType,
    editTab, setEditTab,
    rewriteModel, setRewriteModel,
    modalImages, setModalImages,
    selectionRangeRef,
    activeEditIdRef,
    openSelectionRewriteModal,
    handleRewriteSubmit,
    handleSectionRemove,
  };
}
