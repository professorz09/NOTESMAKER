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
} from '../services/ai/index';
import { getSectionNodes, extractImagesFromHtml, getScrollParent, STORAGE_KEY } from '../utils/editorUtils';
import { sanitizeHtml } from '../utils/sanitize';
import { toast } from '../components/Toast';

type EditTab = 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'diagram' | 'table';

interface UseAIEditProps {
  isEditing: boolean;
  generatedHtml: string | null;
  getCurrentHtml: () => string;
  pushToHistory: (content: string) => void;
  saveToStorage: () => void | string | undefined;
  editorRef: RefObject<HTMLDivElement | null>;
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
      // First pass: clean stale triggers to avoid duplicates on content update
      editorRef.current.querySelectorAll('.ai-edit-trigger').forEach(b => b.remove());
      editorRef.current.querySelectorAll('.table-sparkle-bar').forEach(bar => bar.remove());
      editorRef.current.querySelectorAll('.table-extend-bar').forEach(bar => bar.remove());
      editorRef.current.querySelectorAll('[data-table-id]').forEach(el => (el as HTMLElement).removeAttribute('data-table-id'));

      const elements = editorRef.current.querySelectorAll('h1, h2, h3, h4, li, table, .flowchart-container');
      elements.forEach((el) => {
        const btn = document.createElement('span');
        btn.contentEditable = 'false';
        btn.className = 'ai-edit-trigger no-print';
        btn.innerHTML = '✨';
        btn.title = 'Rewrite/Expand';

        if (el.tagName === 'TABLE') {
          const parentEl = el.parentElement;
          if (parentEl) {
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
      editorRef.current.querySelectorAll('caption.empty-caption').forEach(cap => cap.remove());
      editorRef.current.querySelectorAll('tfoot.table-extend-tfoot').forEach(tfoot => tfoot.remove());
    }
  }, [isEditing, generatedHtml, editorRef]);

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

  const handleTableExtend = useCallback((tableEl: Element) => {
    if (!editorRef.current) return;
    const currentRaw = getCurrentHtml();
    pushToHistory(currentRaw);
    setGeneratedHtml(currentRaw);

    const thead = tableEl.querySelector('thead');
    const headersHtml = thead ? thead.innerHTML : '';

    const tbody = tableEl.querySelector('tbody');
    const allRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    const lastRows = allRows.slice(Math.max(0, allRows.length - 2));
    const lastRowsHtml = lastRows.map(r => {
      const clone = r.cloneNode(true) as Element;
      clone.querySelectorAll('.ai-edit-trigger').forEach(t => t.remove());
      return clone.outerHTML;
    }).join('');

    isTableExtendMode.current = true;
    extendTableRef.current = tableEl;
    extendContextRef.current = { headersHtml, lastRowsHtml };

    const tempDiv2 = document.createElement('div');
    tempDiv2.innerHTML = headersHtml;
    const headerTexts = Array.from(tempDiv2.querySelectorAll('th'))
      .map(th => th.textContent?.trim())
      .filter(Boolean);
    setExtendHeadersPreview(headerTexts.join(' | ') || 'Table context captured');

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
      if (isRewriting) return; // block new edits while one is in progress
      e.preventDefault();
      e.stopPropagation();

      if (trigger.classList.contains('table-extend-btn')) {
        const bar = trigger.closest('.table-extend-bar') as HTMLElement;
        const table = bar?.previousElementSibling as Element;
        if (table?.tagName === 'TABLE') handleTableExtend(table);
        return;
      }

      const sparkleBar = trigger.closest('.table-sparkle-bar') as HTMLElement;
      if (sparkleBar) {
        const tableId = sparkleBar.dataset.for;
        const table = tableId
          ? editorRef.current?.querySelector(`[data-table-id="${tableId}"]`)
          : sparkleBar.nextElementSibling;
        if (table) handleSectionEdit(table as Element);
        return;
      }

      let parent = trigger.parentElement;
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
  }, [isEditing, isRewriting, handleSectionEdit, handleTableExtend, editorRef]);

  const openSelectionRewriteModal = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
      toast.info('Please select some text to rewrite.');
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

      // ── Special path: Extend Table ──
      if (isTableExtendMode.current && extendTableRef.current && extendContextRef.current) {
        const tableEl = extendTableRef.current;
        const ctx = extendContextRef.current;
        const newRows = await extendTableRows(ctx.headersHtml, ctx.lastRowsHtml, rewriteInstruction, rewriteModel);

        if (isResettingRef.current) return;
        if (!newRows) throw new Error('No rows generated');

        let tbody = tableEl.querySelector('tbody');
        if (!tbody) {
          tbody = document.createElement('tbody');
          const tfoot = tableEl.querySelector('tfoot');
          tableEl.insertBefore(tbody, tfoot || null);
        }
        const tempDiv = document.createElement('tbody');
        tempDiv.innerHTML = sanitizeHtml(newRows);
        const newTrNodes = Array.from(tempDiv.querySelectorAll('tr'));
        newTrNodes.forEach(tr => tbody!.appendChild(tr));

        const updatedHtml = editorRef.current!.innerHTML;
        setGeneratedHtml(updatedHtml);
        localStorage.setItem(STORAGE_KEY, updatedHtml);
        setRewriteModalOpen(false);
        setModalImages([]);
        isTableExtendMode.current = false;
        extendTableRef.current = null;
        extendContextRef.current = null;
        toast.success('Table extended successfully!');
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
      if (!resultHtml) throw new Error('No content generated. Please try again.');

      // Sanitize AI-generated HTML before insertion
      resultHtml = sanitizeHtml(resultHtml);

      // Safety net: ensure original heading present in rewrite / expand / next_topic
      if (rewriteType === 'section' && (editTab === 'rewrite' || editTab === 'expand' || editTab === 'next_topic')) {
        const headingMatch = activeSectionHtml.match(/^(\s*<(h[1-4])[^>]*>[\s\S]*?<\/\2>)/i);
        if (headingMatch) {
          const originalHeading = headingMatch[1];
          const headingTag = headingMatch[2];
          const resultHasHeading = new RegExp(`<${headingTag}[\\s>]`, 'i').test(resultHtml);
          if (!resultHasHeading) {
            resultHtml = originalHeading + '\n' + resultHtml;
          }
        }
      }

      // Duplicate-strip for continue / next_topic
      if (rewriteType === 'section' && (editTab === 'continue' || editTab === 'next_topic')) {
        const origHeadingMatch = activeSectionHtml.match(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/i);
        if (origHeadingMatch) {
          const origText = origHeadingMatch[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
          const leadMatch = resultHtml.match(/^(\s*<(h[1-4])[^>]*>([\s\S]*?)<\/\2>)/i);
          if (leadMatch) {
            const leadText = leadMatch[3].replace(/<[^>]+>/g, '').trim().toLowerCase();
            if (leadText === origText || origText.includes(leadText) || leadText.includes(origText)) {
              resultHtml = resultHtml.slice(leadMatch[0].length).trimStart();
            }
          }
        }
      }

      // Save scroll position before DOM mutation
      const scrollEl = editorRef.current ? getScrollParent(editorRef.current) : null;
      const savedScroll = scrollEl ? scrollEl.scrollTop : 0;

      if (rewriteType === 'section') {
        const editId = activeEditIdRef.current;
        if (!editorRef.current || !editId) throw new Error('Editor context lost. Please try again.');
        const startNode = editorRef.current.querySelector(`[data-edit-id="${editId}"]`);
        if (!startNode) throw new Error('Selection position lost. Please try again.');
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

      if (scrollEl) scrollEl.scrollTop = savedScroll;

      setRewriteModalOpen(false);
      setModalImages([]);
      if (editorRef.current) {
        const raw = getCurrentHtml();
        setGeneratedHtml(raw);
        pushToHistory(raw);
        saveToStorage();
      }
      toast.success('Changes applied!');
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error('Rewrite failed:', error);
        toast.error(`AI edit failed: ${error.message || 'Unknown error. Please try again.'}`);
      }
    } finally {
      if (!isResettingRef.current) setIsRewriting(false);
      isTableExtendMode.current = false;
      extendTableRef.current = null;
      extendContextRef.current = null;
      setIsExtendTableOpen(false);
    }
  };

  const handleSectionRemove = useCallback(() => {
    if (!editorRef.current) return;
    const editId = activeEditIdRef.current;
    if (!editId) return;
    const startNode = editorRef.current.querySelector(`[data-edit-id="${editId}"]`);
    if (!startNode) return;
    const nodesToRemove = getSectionNodes(startNode);
    pushToHistory(getCurrentHtml());
    nodesToRemove.forEach(n => n.remove());
    editorRef.current.querySelectorAll('.table-sparkle-bar, .table-extend-bar').forEach(bar => bar.remove());
    const raw = editorRef.current.innerHTML;
    setGeneratedHtml(raw);
    saveToStorage();
    setRewriteModalOpen(false);
    activeEditIdRef.current = null;
    toast.success('Section removed.');
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
