import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  PanelLeft,
  Undo,
  Redo,
  Minus,
  Plus,
  Wand2,
  Check,
  PenTool,
  Printer,
  Download,
  FileText,
  Moon,
  Sun,
  ListOrdered,
  AlignJustify,
  Type,
  ChevronDown,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import '../liquid-top.css';

interface ToolbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fontSize: number;
  handleZoomOut: () => void;
  handleZoomIn: () => void;
  lineHeight: number;
  handleLineHeightIncrease: () => void;
  handleLineHeightDecrease: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  execFormat: (command: 'bold' | 'italic' | 'underline') => void;
  openSelectionRewriteModal: () => void;
  saveToStorage: () => void;
  handleExportPDF: () => void;
  handleDownloadPdfDirect: () => void;
  isDownloadingPdf: boolean;
  handleDownloadDocx: () => void;
  isDownloadingDocx: boolean;
  handleAddTableOfContents: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const IconBtn: React.FC<{
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, onMouseDown, disabled, title, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseDown={onMouseDown}
    disabled={disabled}
    title={title}
    aria-label={title}
    className={`nmt-btn ${className}`}
  >
    {children}
  </button>
);

// Toolbar buttons act on the editor's current text selection, so a plain
// onClick would first steal focus from the editor and collapse that
// selection. preventDefault on mousedown keeps the selection alive through
// the click.
const keepSelection = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();

const Spinner = () => (
  <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// A button with a dropdown panel, positioned against the button's rect so
// the bar's sideways scroll (narrow phones while editing) can't clip it.
const Menu: React.FC<{
  label: React.ReactNode;
  title: string;
  buttonClass?: string;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}> = ({ label, title, buttonClass = 'nmt-btn', width = 248, children }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 8, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${buttonClass}${open ? ' on' : ''}`}
      >
        {label}
      </button>
      {/* Portalled: the bar's backdrop-filter makes it the containing block
          for position:fixed children, which threw the panel off-screen. The
          .nm-app wrapper carries the theme class, so render inside it. */}
      {open && pos && createPortal(
        <div ref={panelRef} role="menu" className="nmt-menu nm-pop" style={{ top: pos.top, left: pos.left, width }}>
          {children(close)}
        </div>,
        btnRef.current?.closest('.nm-app') ?? document.body,
      )}
    </>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, hint, onClick, disabled }) => (
  <button type="button" role="menuitem" className="nmt-item" onClick={onClick} disabled={disabled}>
    <span className="nmt-item-ico">{icon}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="nmt-item-label">{label}</span>
      {hint && <span className="nmt-item-hint">{hint}</span>}
    </span>
  </button>
);

const Stepper: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}> = ({ icon, label, value, onDec, onInc }) => (
  <div className="nmt-step">
    <span className="nmt-item-ico">{icon}</span>
    <span className="nmt-item-label flex-1">{label}</span>
    <div className="nmt-step-ctl">
      <button type="button" onClick={onDec} aria-label={`Decrease ${label.toLowerCase()}`}><Minus className="w-3.5 h-3.5" /></button>
      <span>{value}</span>
      <button type="button" onClick={onInc} aria-label={`Increase ${label.toLowerCase()}`}><Plus className="w-3.5 h-3.5" /></button>
    </div>
  </div>
);

export const Toolbar: React.FC<ToolbarProps> = ({
  sidebarOpen, setSidebarOpen,
  handleUndo, handleRedo, canUndo, canRedo,
  fontSize, handleZoomOut, handleZoomIn,
  lineHeight, handleLineHeightIncrease, handleLineHeightDecrease,
  isEditing, setIsEditing, execFormat,
  openSelectionRewriteModal, saveToStorage,
  handleExportPDF, handleDownloadPdfDirect, isDownloadingPdf,
  handleDownloadDocx, isDownloadingDocx,
  handleAddTableOfContents,
  isDarkMode, toggleDarkMode,
}) => {
  const busy = isDownloadingPdf || isDownloadingDocx;
  // One quiet row: navigation and history on the left, the document's
  // actions on the right. Everything secondary lives in two menus — "Aa"
  // (reading size, spacing, theme) and Export — so the bar fits a phone
  // without scrolling and reads as one control, not a row of chips.
  return (
    <div className="nm-tb nmt absolute left-2 right-2 sm:left-3 sm:right-3 md:left-4 md:right-4 xl:left-7 xl:right-7 z-30 no-print">
      <div className="nm-tb-row flex items-center gap-1 p-[5px] overflow-x-auto">
        <IconBtn
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          className={sidebarOpen ? 'on' : ''}
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </IconBtn>

        <span className="nmt-sep" aria-hidden="true" />

        <IconBtn onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo className="w-[18px] h-[18px]" />
        </IconBtn>
        <IconBtn onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo className="w-[18px] h-[18px]" />
        </IconBtn>

        {/* Bold / Italic / Underline — only while editing. Mirrors Ctrl+B/I/U
            for touch users who have no keyboard shortcut. */}
        {isEditing && (
          <>
            <span className="nmt-sep" aria-hidden="true" />
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('bold')} title="Bold (Ctrl+B)">
              <Bold className="w-[18px] h-[18px]" />
            </IconBtn>
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('italic')} title="Italic (Ctrl+I)">
              <Italic className="w-[18px] h-[18px]" />
            </IconBtn>
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('underline')} title="Underline (Ctrl+U)">
              <Underline className="w-[18px] h-[18px]" />
            </IconBtn>
          </>
        )}

        <div className="flex-1 min-w-1" aria-hidden="true" />

        {isEditing ? (
          <>
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={openSelectionRewriteModal}
              className="nmt-text accent"
              title="Rewrite the selected text with AI"
              aria-label="Rewrite selected text"
            >
              <Wand2 className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Rewrite</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); saveToStorage(); }}
              className="nmt-text done"
              title="Done editing (Ctrl+E)"
              aria-label="Done editing"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Done</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="nmt-text"
            title="Edit document (Ctrl+E)"
            aria-label="Edit document"
          >
            <PenTool className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        <Menu title="Reading view — text size, spacing, theme" width={272} label={<Type className="w-[18px] h-[18px]" />}>
          {() => (
            <>
              <p className="nmt-menu-head">Reading view</p>
              <Stepper icon={<Type className="w-4 h-4" />} label="Text size" value={String(fontSize)} onDec={handleZoomOut} onInc={handleZoomIn} />
              <Stepper icon={<AlignJustify className="w-4 h-4" />} label="Line spacing" value={lineHeight.toFixed(1)} onDec={handleLineHeightDecrease} onInc={handleLineHeightIncrease} />
              <div className="nmt-rule" />
              <div className="nmt-seg" role="group" aria-label="Theme">
                <button type="button" className={!isDarkMode ? 'on' : ''} onClick={() => { if (isDarkMode) toggleDarkMode(); }}>
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button type="button" className={isDarkMode ? 'on' : ''} onClick={() => { if (!isDarkMode) toggleDarkMode(); }}>
                  <Moon className="w-4 h-4" /> Dark
                </button>
              </div>
            </>
          )}
        </Menu>

        <Menu
          title="Export — PDF, Word, print"
          buttonClass="nmt-primary"
          width={272}
          label={<>
            {busy ? <Spinner /> : <Download className="w-4 h-4 flex-shrink-0" />}
            <span className="hidden sm:inline">{busy ? 'Preparing…' : 'Export'}</span>
            <ChevronDown className="w-3.5 h-3.5 hidden sm:block opacity-70" />
          </>}
        >
          {(close) => (
            <>
              <p className="nmt-menu-head">Export</p>
              <MenuItem
                icon={isDownloadingPdf ? <Spinner /> : <Download className="w-4 h-4" />}
                label="Download PDF"
                hint="Saved straight to your device"
                disabled={isDownloadingPdf}
                onClick={() => { close(); handleDownloadPdfDirect(); }}
              />
              <MenuItem
                icon={isDownloadingDocx ? <Spinner /> : <FileText className="w-4 h-4" />}
                label="Download Word (.docx)"
                hint="Editable document"
                disabled={isDownloadingDocx}
                onClick={() => { close(); handleDownloadDocx(); }}
              />
              <MenuItem
                icon={<Printer className="w-4 h-4" />}
                label="Print…"
                hint="Browser print dialog — paper & margins"
                onClick={() => { close(); handleExportPDF(); }}
              />
              <div className="nmt-rule" />
              <MenuItem
                icon={<ListOrdered className="w-4 h-4" />}
                label="Table of contents"
                hint="Add or remove the index at the top"
                onClick={() => { close(); handleAddTableOfContents(); }}
              />
            </>
          )}
        </Menu>
      </div>
    </div>
  );
};
