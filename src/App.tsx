import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  generateTopicContent, 
  generateTopicComparisonTable,
  generateTopicDetailedTable,
  generateFormattedNotes, 
  generateFileNotes,
  rewriteContent, 
  rewriteSection,
  expandSection,
  generateNextContent, 
  generateDetailedNextTopic,
  generateSectionImage,
  generateComplexTable,
  generateDiagram,
  generateUPSCAnswer
} from './services/ai';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { RewriteModal } from './components/RewriteModal';
import { GenerationStatus } from './types';
import { Button } from './components/Button';
import { 
  BookOpen, 
  PenTool, 
  Printer, 
  Sparkles,
  FileText,
  Trash2,
  Wand2,
  ArrowLeft,
  Check,
  Save,
  Undo,
  Redo,
  RefreshCw,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Download,
  Eraser,
  Settings,
  Image as ImageIcon,
  Minus,
  Type,
  Table as TableIcon,
  Upload,
  X,
  GraduationCap
} from 'lucide-react';

const STORAGE_KEY = 'ai_book_writer_draft';

const App: React.FC = () => {
  // --- API KEY STATE ---
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState<boolean>(true);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        // @ts-ignore
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          // If not running in AI Studio environment, assume true or handle differently
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Failed to check API key", e);
        setHasApiKey(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Failed to open API key selector", e);
      // If the request fails with "Requested entity was not found", reset state
      setHasApiKey(false);
    }
  };

  // --- UI STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fontSize, setFontSize] = useState(12); // Default to 12pt (Normal)
  const [pageSize, setPageSize] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_book_writer_dark') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ai_book_writer_dark', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  
  // --- GENERATION STATE ---
  const [mode, setMode] = useState<'topic' | 'text' | 'file'>('topic');
  const [outputStyle, setOutputStyle] = useState<'notes' | 'upsc'>('notes');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [language, setLanguage] = useState('Hindi'); 
  const [aiModel, setAiModel] = useState('gemini-3.1-pro-preview');
  const [topicInput, setTopicInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [files, setFiles] = useState<{ name: string; mimeType: string; data: string }[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files) as File[];
    
    selectedFiles.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        let mimeType = file.type;
        if (!mimeType) {
          if (file.name.endsWith('.txt')) mimeType = 'text/plain';
          else if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
          else mimeType = 'application/octet-stream';
        }
        setFiles(prev => [...prev, { name: file.name, mimeType, data: base64Data }]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- EDITOR STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // --- HISTORY STATE ---
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- REWRITE STATE ---
  const isResettingRef = useRef(false);
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const selectionRangeRef = useRef<Range | null>(null);
  const activeEditIdRef = useRef<string | null>(null);
  const [activeSectionHtml, setActiveSectionHtml] = useState<string>('');
  const [rewriteType, setRewriteType] = useState<'selection' | 'section'>('selection');
  const [editTab, setEditTab] = useState<'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'table' | 'diagram'>('rewrite');
  const [rewriteModel, setRewriteModel] = useState<string>('gemini-3-flash-preview'); // Added rewrite model state

  // --- 1. INITIALIZATION & HISTORY ---

  const pushToHistory = useCallback((content: string) => {
    setHistory(prev => {
      if (historyIndex >= 0 && prev[historyIndex] === content) return prev;
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, content];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEY);
    if (savedContent) {
      setGeneratedHtml(savedContent);
      setHistory([savedContent]);
      setHistoryIndex(0);
    }
  }, []);

  // --- 2. EDITOR HELPERS ---

  const getCurrentHtml = useCallback(() => {
    return editorRef.current ? editorRef.current.innerHTML : (generatedHtml || '');
  }, [generatedHtml]);

  const getCleanHtml = useCallback(() => {
    if (!editorRef.current) return generatedHtml || '';
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.ai-edit-trigger').forEach(b => b.remove());
    clone.querySelectorAll('[data-edit-id]').forEach(el => el.removeAttribute('data-edit-id'));
    // Clean up font tags that might have been left over from resizing
    clone.querySelectorAll('font').forEach(font => {
       const span = document.createElement('span');
       span.innerHTML = font.innerHTML;
       // If font has size attribute but no style, we might want to convert or drop it
       // But our resize logic replaces size with style, so just keep style
       if(font.getAttribute('style')) span.setAttribute('style', font.getAttribute('style')!);
       font.replaceWith(span);
    });
    return clone.innerHTML;
  }, [generatedHtml]);

  const saveToStorage = useCallback(() => {
    if (isResettingRef.current) return;
    const content = getCleanHtml();
    if (content) {
      localStorage.setItem(STORAGE_KEY, content);
    }
    return content;
  }, [getCleanHtml]);

  // Sync content state to DOM without resetting cursor during edits
  useEffect(() => {
    if (editorRef.current) {
        // Only update DOM if the new generatedHtml is logically different
        // This prevents re-renders from killing the cursor position during typing
        if (editorRef.current.innerHTML !== (generatedHtml || '')) {
             editorRef.current.innerHTML = generatedHtml || '';
        }
    }
  }, [generatedHtml]);

  // Auto-save logic
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveToStorage();
    };
    const intervalId = setInterval(() => { if (isEditing) saveToStorage(); }, 5000);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', saveToStorage);
    window.addEventListener('beforeunload', saveToStorage);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', saveToStorage);
      window.removeEventListener('beforeunload', saveToStorage);
      clearInterval(intervalId);
    };
  }, [saveToStorage, isEditing]);

  const handleEditorInput = () => {
    if (isResettingRef.current) return;
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
       if (isResettingRef.current) return;
       const rawContent = getCurrentHtml(); 
       // Only update state if content actually changed
       if (rawContent !== generatedHtml) {
           setGeneratedHtml(rawContent); 
           pushToHistory(rawContent);
           saveToStorage();
       }
    }, 800);
  };

  const handleEditorBlur = () => {
      if (isResettingRef.current) return;
      const rawContent = getCurrentHtml();
      setGeneratedHtml(rawContent);
  };

  // --- FONT SIZE HANDLERS ---
  const handleZoomIn = () => setFontSize(p => Math.min(p + 1, 18));
  const handleZoomOut = () => setFontSize(p => Math.max(p - 1, 8));

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Check for Cmd/Ctrl + '+' or Cmd/Ctrl + '-' (including '=' which is unshifted +)
    if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+' || e.key === '-')) {
      e.preventDefault();
      
      const selection = window.getSelection();
      // Only proceed if there is an actual text selection (not just cursor)
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      // 1. Calculate new size based on the start of the selection context
      const parentEl = selection.anchorNode?.parentElement;
      if (!parentEl) return;
      
      const currentSize = parseFloat(window.getComputedStyle(parentEl).fontSize);
      const change = (e.key === '=' || e.key === '+') ? 2 : -2;
      const newSize = Math.max(8, currentSize + change);

      // 2. Use execCommand to wrap selection.
      // We use the 'fontSize' command with value '7' (largest) as a temporary marker.
      // This is the most reliable way to handle selections that span multiple nodes/tags.
      // styleWithCSS: false ensures it creates <font size="7"> tags.
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('fontSize', false, '7');

      // 3. Find the markers and apply specific pixel size
      const markers = editorRef.current?.querySelectorAll('font[size="7"]');
      markers?.forEach(el => {
          el.removeAttribute('size');
          // el is an HTMLElement, but TS might see Element
          (el as HTMLElement).style.fontSize = `${newSize}px`;
          // Optional: Convert font tag to span for cleaner DOM, though visually identical
          // We keep it simple here to ensure stability
      });

      handleEditorInput(); 
    }
  };

  // --- 3. CORE GENERATION LOGIC ---

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'topic' && !topicInput.trim()) return;
    if (mode === 'text' && !textInput.trim()) return;
    if (mode === 'file' && files.length === 0) return;

    setStatus(GenerationStatus.GENERATING_CHAPTER);
    
    try {
      let result = "";
      if (mode === 'topic') {
        if (outputStyle === 'upsc') {
          result = await generateUPSCAnswer(topicInput, language, aiModel);
        } else {
          result = await generateTopicContent(topicInput, language, aiModel);
        }
      } else if (mode === 'text') {
        result = await generateFormattedNotes(textInput, language, aiModel, outputStyle);
      } else if (mode === 'file') {
        result = await generateFileNotes(files, language, aiModel, outputStyle);
      }

      if (isResettingRef.current) return;

      setGeneratedHtml(result);
      pushToHistory(result);
      localStorage.setItem(STORAGE_KEY, result); 
      
      // On mobile, auto-close sidebar after generation for better UX
      if (window.innerWidth < 768) {
          setSidebarOpen(false);
      }

    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error(error);
        alert(`Error generating content: ${error.message || "Unknown error"}`);
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
      }
    }
  };

  const handleGenerateTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) {
        alert("Please enter a topic first.");
        return;
    }

    setStatus(GenerationStatus.GENERATING_TABLE);
    
    try {
      const result = await generateTopicComparisonTable(topicInput, language, aiModel);

      if (isResettingRef.current) return;

      setGeneratedHtml(result);
      pushToHistory(result);
      localStorage.setItem(STORAGE_KEY, result); 
      
      if (window.innerWidth < 768) {
          setSidebarOpen(false);
      }

    } catch (error) {
      if (!isResettingRef.current) {
        console.error(error);
        alert("Error generating table. Please try again.");
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
      }
    }
  };

  const handleGenerateDetailedTable = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) {
        alert("Please enter a topic first.");
        return;
    }

    setStatus(GenerationStatus.GENERATING_DETAILED_TABLE);
    
    try {
      const result = await generateTopicDetailedTable(topicInput, language, aiModel);

      if (isResettingRef.current) return;

      setGeneratedHtml(result);
      pushToHistory(result);
      localStorage.setItem(STORAGE_KEY, result); 
      
      if (window.innerWidth < 768) {
          setSidebarOpen(false);
      }

    } catch (error) {
      if (!isResettingRef.current) {
        console.error(error);
        alert("Error generating table. Please try again.");
      }
    } finally {
      if (!isResettingRef.current) {
        setStatus(GenerationStatus.IDLE);
      }
    }
  };

  const handleClearCanvas = () => {
    if(!confirm("Are you sure you want to clear the editor?")) return;
    isResettingRef.current = true;
    setGeneratedHtml(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsEditing(false);
    activeEditIdRef.current = null;
    selectionRangeRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => { isResettingRef.current = false; }, 100);
  };

  // --- 4. REWRITE & EDIT LOGIC ---
  // (Helper for edit buttons)
  const getSectionNodes = (startNode: Element): Element[] => {
    const nodes: Element[] = [startNode];
    const tagName = startNode.tagName;
    const getLevel = (tag: string) => {
      const t = tag.toUpperCase();
      if (t === 'H1') return 1;
      if (t === 'H2') return 2;
      if (t === 'H3') return 3;
      if (t === 'H4') return 4;
      return 10; 
    };
    const currentLevel = getLevel(tagName);
    if (currentLevel <= 4) {
      let nextSibling = startNode.nextElementSibling;
      while (nextSibling) {
        const nextTag = nextSibling.tagName;
        const nextLevel = getLevel(nextTag);
        if (nextLevel <= currentLevel) break;
        nodes.push(nextSibling);
        nextSibling = nextSibling.nextElementSibling;
      }
    } 
    return nodes;
  };

  useEffect(() => {
    if (!editorRef.current) return;
    if (isEditing) {
      const elements = editorRef.current.querySelectorAll('h1, h2, h3, h4, li, table, .flowchart-container');
      elements.forEach((el) => {
        if (el.querySelector('.ai-edit-trigger')) return;
        
        const btn = document.createElement('span');
        btn.contentEditable = "false";
        btn.className = "ai-edit-trigger no-print";
        btn.innerHTML = "✨";
        btn.title = "Rewrite/Expand";

        if (el.tagName === 'TABLE') {
             let cap = el.querySelector('caption');
             if (!cap) {
                 cap = document.createElement('caption');
                 cap.className = 'empty-caption';
                 el.prepend(cap);
             }
             btn.style.position = 'absolute';
             btn.style.right = '-10px';
             btn.style.top = '-10px';
             btn.style.zIndex = '10';
             cap.appendChild(btn);

             // Add Extend Table button at the bottom
             let tfoot = el.querySelector('tfoot.table-extend-tfoot');
             if (!tfoot) {
                 tfoot = document.createElement('tfoot');
                 tfoot.className = 'table-extend-tfoot no-print';
                 const tr = document.createElement('tr');
                 const td = document.createElement('td');
                 
                 let colCount = 1;
                 const firstRow = el.querySelector('tr');
                 if (firstRow) colCount = firstRow.children.length;
                 
                 td.colSpan = colCount;
                 td.style.textAlign = 'center';
                 td.style.padding = '12px';
                 td.style.border = 'none';
                 td.style.backgroundColor = 'transparent';
                 
                 tr.appendChild(td);
                 tfoot.appendChild(tr);
                 el.appendChild(tfoot);
             }
             
             const td = tfoot.querySelector('td');
             if (td && !td.querySelector('.table-extend-btn')) {
                 const extendBtn = document.createElement('span');
                 extendBtn.contentEditable = "false";
                 extendBtn.className = "ai-edit-trigger table-extend-btn no-print";
                 extendBtn.innerHTML = "➕ Extend Table";
                 extendBtn.title = "Add rows or columns";
                 extendBtn.style.display = "inline-flex";
                 extendBtn.style.alignItems = "center";
                 extendBtn.style.gap = "6px";
                 extendBtn.style.padding = "6px 16px";
                 extendBtn.style.backgroundColor = "#f8fafc";
                 extendBtn.style.border = "1px dashed #cbd5e1";
                 extendBtn.style.borderRadius = "8px";
                 extendBtn.style.fontSize = "12px";
                 extendBtn.style.color = "#475569";
                 extendBtn.style.cursor = "pointer";
                 extendBtn.style.fontWeight = "600";
                 extendBtn.style.transition = "all 0.2s";
                 
                 td.appendChild(extendBtn);
             }
        } else if (el.classList.contains('flowchart-container')) {
             btn.style.position = 'absolute';
             btn.style.right = '10px';
             btn.style.top = '10px';
             btn.style.zIndex = '10';
             btn.style.backgroundColor = '#fff'; 
             el.appendChild(btn);
        } else if (el.tagName === 'LI') {
             el.insertBefore(btn, el.firstChild);
        } else {
             el.appendChild(btn);
        }
      });
    } else {
      editorRef.current.querySelectorAll('.ai-edit-trigger').forEach(btn => btn.remove());
      // Cleanup empty captions created for buttons
      editorRef.current.querySelectorAll('caption').forEach(cap => {
          if (cap.innerHTML.trim() === '') cap.remove();
      });
      // Cleanup tfoot created for extend buttons
      editorRef.current.querySelectorAll('tfoot.table-extend-tfoot').forEach(tfoot => tfoot.remove());
    }
  }, [isEditing, generatedHtml]);

  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const trigger = target.closest('.ai-edit-trigger') as HTMLElement;
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        let parentEl = trigger.parentElement;
        // Fix for Table Caption
        if (parentEl?.tagName === 'CAPTION') {
            parentEl = parentEl.parentElement;
        }
        // Fix for Table Tfoot
        if (parentEl?.tagName === 'TD' && parentEl.parentElement?.parentElement?.tagName === 'TFOOT') {
            parentEl = parentEl.parentElement.parentElement.parentElement;
        }
        if (parentEl) handleSectionEdit(parentEl, trigger.classList.contains('table-extend-btn') ? 'table' : undefined);
      }
    };
    const editor = editorRef.current;
    if (editor) editor.addEventListener('click', handleEditorClick);
    return () => { if (editor) editor.removeEventListener('click', handleEditorClick); };
  }, [isEditing]);

  const handleSectionEdit = (startNode: Element, defaultTab?: 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'table' | 'diagram') => {
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
        clone.querySelectorAll('.ai-edit-trigger').forEach(trigger => trigger.remove());
        const tfoot = clone.querySelector('tfoot.table-extend-tfoot');
        if (tfoot) tfoot.remove();
        clone.removeAttribute('data-edit-id'); 
        tempDiv.appendChild(clone);
    });
    setActiveSectionHtml(tempDiv.innerHTML);
    setGeneratedHtml(editorRef.current.innerHTML); 
    setRewriteType('section');
    setEditTab(defaultTab || 'rewrite');
    setRewriteInstruction('');
    setRewriteModalOpen(true);
  };

  const openSelectionRewriteModal = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) {
      alert("Please select text to rewrite.");
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
      let resultHtml = "";

      if (rewriteType === 'section') {
         if (editTab === 'rewrite') resultHtml = await rewriteSection(activeSectionHtml, rewriteInstruction, rewriteModel);
         else if (editTab === 'expand') resultHtml = await expandSection(activeSectionHtml, rewriteInstruction, rewriteModel);
         else if (editTab === 'continue') resultHtml = await generateNextContent(activeSectionHtml, rewriteInstruction, rewriteModel);
         else if (editTab === 'next_topic') resultHtml = await generateDetailedNextTopic(activeSectionHtml, rewriteInstruction, rewriteModel);
         else if (editTab === 'image') {
             const imgHtml = await generateSectionImage(activeSectionHtml, rewriteInstruction);
             resultHtml = activeSectionHtml + imgHtml;
         } else if (editTab === 'table') {
             resultHtml = await generateComplexTable(activeSectionHtml, rewriteInstruction, rewriteModel);
         } else if (editTab === 'diagram') {
             const diagramHtml = await generateDiagram(activeSectionHtml, rewriteInstruction, rewriteModel);
             resultHtml = activeSectionHtml + diagramHtml;
         }
      } else {
         const selectedText = selectionRangeRef.current?.toString() || "";
         if (editTab === 'rewrite') resultHtml = await rewriteContent(selectedText, rewriteInstruction, rewriteModel);
         else if (editTab === 'expand') resultHtml = await expandSection(selectedText, rewriteInstruction, rewriteModel);
         else if (editTab === 'continue') {
             const nextContent = await generateNextContent(selectedText, rewriteInstruction, rewriteModel);
             resultHtml = selectedText + " " + nextContent;
         } else if (editTab === 'next_topic') {
             const nextContent = await generateDetailedNextTopic(selectedText, rewriteInstruction, rewriteModel);
             resultHtml = selectedText + " " + nextContent;
         } else if (editTab === 'image') {
             const imgHtml = await generateSectionImage(selectedText, rewriteInstruction);
             // For selection, we append the image after the text
             resultHtml = selectedText + "<br/>" + imgHtml;
         } else if (editTab === 'table') {
             resultHtml = await generateComplexTable(selectedText, rewriteInstruction, rewriteModel);
         } else if (editTab === 'diagram') {
             const diagramHtml = await generateDiagram(selectedText, rewriteInstruction, rewriteModel);
             resultHtml = selectedText + "<br/>" + diagramHtml;
         }
      }

      if (isResettingRef.current) return;
      if (!resultHtml) throw new Error("No content generated");

      // DOM Replacement Logic
      if (rewriteType === 'section') {
         const editId = activeEditIdRef.current;
         if (!editorRef.current || !editId) throw new Error("Editor context lost.");
         const startNode = editorRef.current.querySelector(`[data-edit-id="${editId}"]`);
         if (!startNode) throw new Error("Lost position.");
         const nodesToReplace = getSectionNodes(startNode);
         const firstNode = nodesToReplace[0];
         const lastNode = nodesToReplace[nodesToReplace.length - 1];
         const parent = firstNode.parentNode;
         if (!parent) throw new Error("Parent node lost.");

         const range = document.createRange();
         range.setStartBefore(firstNode);
         const fragment = range.createContextualFragment(resultHtml);

         if (editTab === 'continue' || editTab === 'next_topic') {
            if (lastNode.nextSibling) parent.insertBefore(fragment, lastNode.nextSibling);
            else parent.appendChild(fragment);
            startNode.removeAttribute('data-edit-id');
         } else {
            parent.insertBefore(fragment, firstNode);
            nodesToReplace.forEach(n => n.remove());
         }
      } else {
         const range = selectionRangeRef.current;
         if (range) {
             const fragment = range.createContextualFragment(resultHtml);
             range.deleteContents();
             range.insertNode(fragment);
             const selection = window.getSelection();
             selection?.removeAllRanges();
         }
      }
      setRewriteModalOpen(false);
      if (editorRef.current) {
        const rawContent = getCurrentHtml();
        setGeneratedHtml(rawContent);
        pushToHistory(rawContent);
        saveToStorage();
      }
    } catch (error: any) {
      if (!isResettingRef.current) {
        console.error("Rewrite failed:", error);
        alert(`Rewrite failed: ${error.message || "Unknown error"}`);
      }
    } finally {
      if (!isResettingRef.current) setIsRewriting(false);
    }
  };

  // --- 5. PDF EXPORT ---
  const handleExportPDF = () => {
    if (!generatedHtml) return;
    
    // Get clean HTML without the edit triggers
    let contentToPrint = isEditing && editorRef.current ? getCleanHtml() : generatedHtml;
    
    // Create a temporary div to strip out the star buttons just in case they are still in the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentToPrint;
    const triggers = tempDiv.querySelectorAll('.ai-edit-trigger');
    triggers.forEach(t => t.remove());
    contentToPrint = tempDiv.innerHTML;

    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Enable pop-ups."); return; }
    
    // Pass the current fontSize to the print window or keep default 12pt for formal print
    const printFontSize = fontSize < 10 ? 10 : fontSize;
    const isLandscape = pageSize === 'Landscape';

    const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Export Notes</title>
          <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
              @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 10mm; }
              body { font-family: 'Inter', sans-serif; font-size: ${printFontSize}pt; line-height: 1.4; color: #1e293b; background: white; margin: 0; padding: 0; }
              h1 { font-family: 'Inter', sans-serif; font-size: 2em; font-weight: 800; color: #0f172a; border-bottom: 3px solid #0f172a; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; page-break-after: avoid; }
              h2 { font-family: 'Inter', sans-serif; font-size: 1.5em; font-weight: 700; color: #1e3a8a; margin-top: 16px; margin-bottom: 8px; page-break-after: avoid; border-bottom: 1px solid #e2e8f0; }
              h3 { font-family: 'Inter', sans-serif; font-size: 1.25em; font-weight: 600; color: #334155; margin-top: 12px; margin-bottom: 6px; page-break-after: avoid; }
              h4 { font-family: 'Inter', sans-serif; font-size: 1.1em; font-weight: 600; color: #475569; margin-top: 10px; margin-bottom: 4px; page-break-after: avoid; }
              p { margin-bottom: 8px; text-align: justify; }
              ul, ol { margin-bottom: 8px; padding-left: 20px; }
              li { margin-bottom: 4px; }
              strong { color: #0f172a; font-weight: 700; }
              .key-point { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px; margin: 12px 0; font-family: 'Inter', sans-serif; font-size: 0.95em; page-break-inside: avoid; }
              
              /* FORCE BLACK BORDERS ON PRINT */
              table { width: 100%; border-collapse: collapse; margin: 12px 0; border: 2px solid #000 !important; page-break-inside: auto; font-size: 0.9em; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              th { background-color: #f1f5f9 !important; color: #0f172a !important; padding: 6px; font-weight: 600; text-align: left; font-family: 'Inter', sans-serif; border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              td { border: 1px solid #000 !important; padding: 6px; vertical-align: top; }
              tr:nth-child(even) { background-color: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              
              .flowchart-container { display: flex; justify-content: center; margin: 16px 0; padding: 8px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
              svg { max-width: 100%; height: auto; }

              /* IMAGE PRINT STYLES */
              figure { margin: 16px 0; text-align: center; page-break-inside: avoid; }
              img { max-width: 100%; height: auto; border: 1px solid #ccc; }
              figcaption { font-size: 0.9em; color: #666; font-style: italic; margin-top: 4px; }

              @media print {
                  body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .no-print { display: none !important; }
                  .ai-edit-trigger { display: none !important; }
                  h1, h2, h3, h4 { page-break-after: avoid; }
                  table { page-break-inside: auto; }
                  tr, .flowchart-container, .key-point, figure, img { page-break-inside: avoid; }
                  p, li { orphans: 3; widows: 3; }
              }
          </style>
      </head>
      <body>
          ${contentToPrint}
          <script>
              window.onload = function() { setTimeout(function() { window.print(); }, 800); }
          </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleAddTableOfContents = () => {
    if (!generatedHtml) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = generatedHtml;

    // Check if TOC already exists
    const existingToc = tempDiv.querySelector('.table-of-contents');
    
    if (existingToc) {
      // If it exists, remove it (Toggle OFF)
      existingToc.remove();
      const newHtml = tempDiv.innerHTML;
      setGeneratedHtml(newHtml);
      pushToHistory(newHtml);
      saveToStorage();
      return;
    }

    // If it doesn't exist, generate and add it (Toggle ON)
    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4');
    if (headings.length === 0) {
      alert("No headings found to generate a Table of Contents.");
      return;
    }

    const tocItems: { text: string; id: string; level: number }[] = [];

    headings.forEach((heading, index) => {
      let id = heading.id;
      if (!id) {
        id = `heading-${index}`;
        heading.id = id;
      }
      tocItems.push({
        text: heading.textContent || '',
        id: id,
        level: parseInt(heading.tagName.substring(1))
      });
    });

    const tocHtml = `
      <div class="table-of-contents">
        <h2>Index</h2>
        <nav>
          <ul>
            ${tocItems.map(item => `
              <li style="padding-left: ${(item.level - 1) * 16}px;">
                <a href="#${item.id}">
                  <span class="toc-title">${item.text}</span>
                  <span class="toc-dots"></span>
                  <span class="toc-link-icon">→</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>
      </div>
    `;

    const newHtml = tocHtml + tempDiv.innerHTML;
    setGeneratedHtml(newHtml);
    pushToHistory(newHtml);
    saveToStorage();
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setGeneratedHtml(history[newIndex]);
      setHistoryIndex(newIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setGeneratedHtml(history[newIndex]);
      setHistoryIndex(newIndex);
    }
  };

  // --- RENDER ---
  if (isCheckingApiKey) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 ${isDarkMode ? 'dark' : ''}`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 ${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">API Key Required</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            This application uses advanced image generation models (Gemini 3 Pro Image) which require a paid Google Cloud API key. 
            <br/><br/>
            Please select your API key from a paid Google Cloud project to continue. 
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline ml-1">Learn about billing</a>.
          </p>
          <Button 
            onClick={handleSelectApiKey}
            className="w-full py-3 text-lg shadow-md hover:shadow-lg transition-all"
            variant="primary"
          >
            Select API Key
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden dot-pattern ${isDarkMode ? 'dark' : ''}`}>
      <style>
        {`@media print { @page { size: A4 ${pageSize === 'Landscape' ? 'landscape' : 'portrait'}; margin: 5mm; } }`}
      </style>
      {/* --- SIDEBAR (INPUT) --- */}
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        pageSize={pageSize}
        setPageSize={setPageSize}
        mode={mode}
        setMode={setMode}
        outputStyle={outputStyle}
        setOutputStyle={setOutputStyle}
        topicInput={topicInput}
        setTopicInput={setTopicInput}
        textInput={textInput}
        setTextInput={setTextInput}
        files={files}
        handleFileUpload={handleFileUpload}
        removeFile={removeFile}
        language={language}
        setLanguage={setLanguage}
        aiModel={aiModel}
        setAiModel={setAiModel}
        handleGenerate={handleGenerate}
        handleGenerateTable={handleGenerateTable}
        handleGenerateDetailedTable={handleGenerateDetailedTable}
        status={status}
        handleClearCanvas={handleClearCanvas}
        handleUndo={handleUndo}
        canUndo={historyIndex > 0}
      />

      {/* --- MAIN AREA (EDITOR) --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300">
         
         {/* TOP TOOLBAR - Fixed on Mobile, Floating on Desktop */}
         <Toolbar 
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            fontSize={fontSize}
            handleZoomOut={handleZoomOut}
            handleZoomIn={handleZoomIn}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            openSelectionRewriteModal={openSelectionRewriteModal}
            saveToStorage={saveToStorage}
            handleExportPDF={handleExportPDF}
            handleAddTableOfContents={handleAddTableOfContents}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
         />

         {/* CANVAS AREA */}
         <div className="flex-1 overflow-auto pt-20 md:pt-32 pb-12 px-0 sm:px-4 md:px-8 relative scrollbar-thin scrollbar-track-transparent">
             {status !== GenerationStatus.IDLE && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/60 dark:bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-100 dark:border-slate-700">
                        <div className="w-16 h-16 border-4 border-blue-600 dark:border-blue-500 border-t-transparent dark:border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Creating Content</h3>
                        <p className="text-slate-500 dark:text-slate-400 animate-pulse">Analyzing topic • Structuring • Writing...</p>
                    </div>
                </div>
             )}

             <div className={`w-full mx-auto transition-all duration-700 ease-out ${!generatedHtml && status === GenerationStatus.IDLE ? 'opacity-100' : 'opacity-100'}`}>
                 <div 
                    className={`editor-container page-container size-${pageSize.toLowerCase()} editor-content bg-white dark:bg-slate-900 transition-all duration-300 rounded-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] ring-1 ring-slate-200/50 dark:ring-slate-700/50 ${isEditing ? 'ring-4 ring-blue-500/20 dark:ring-blue-500/40 shadow-blue-500/10 dark:shadow-blue-500/20' : ''}`}
                    style={{ fontSize: `${fontSize}pt` }} 
                 >
                    {!generatedHtml && status === GenerationStatus.IDLE ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50" style={{ minHeight: pageSize === 'A4' ? '250mm' : pageSize === 'A5' ? '170mm' : pageSize === 'Letter' ? '230mm' : '300mm' }}>
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-blue-900/5 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-700 flex items-center justify-center mb-6 sm:mb-8 transform hover:scale-105 transition-transform duration-500 rotate-3">
                                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400 -rotate-3" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-3 sm:mb-4 tracking-tight">Your Empty Canvas</h2>
                            <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-md mb-6 sm:mb-8 leading-relaxed px-4">
                                Use the sidebar to generate a comprehensive study guide, or paste your rough notes to format them instantly.
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-md opacity-80 px-4">
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center transition-transform hover:-translate-y-1">
                                    <Sparkles className="w-6 h-6 text-amber-400 mb-2" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Powered</span>
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center transition-transform hover:-translate-y-1">
                                    <Download className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mb-2" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">PDF Ready</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className={`min-h-[267mm] outline-none ${isEditing ? 'cursor-text' : ''}`}
                            contentEditable={isEditing}
                            suppressContentEditableWarning={true}
                            ref={editorRef}
                            onInput={handleEditorInput}
                            onBlur={handleEditorBlur}
                            onKeyDown={handleEditorKeyDown}
                        />
                    )}
                 </div>
                 <div className="h-12 flex items-center justify-center mt-4 opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">End of Document</span>
                 </div>
             </div>
         </div>

      </main>

      {/* --- REWRITE MODAL --- */}
      <RewriteModal 
        isOpen={rewriteModalOpen}
        onClose={() => setRewriteModalOpen(false)}
        rewriteType={rewriteType}
        editTab={editTab}
        setEditTab={setEditTab}
        rewriteModel={rewriteModel}
        setRewriteModel={setRewriteModel}
        rewriteInstruction={rewriteInstruction}
        setRewriteInstruction={setRewriteInstruction}
        isRewriting={isRewriting}
        handleRewriteSubmit={handleRewriteSubmit}
        selectionText={rewriteType === 'section' ? 'Selected Section Context...' : (selectionRangeRef.current?.toString().substring(0, 150) + '...')}
      />

    </div>
  );
};

export default App;