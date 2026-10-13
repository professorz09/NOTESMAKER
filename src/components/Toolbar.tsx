import React from 'react';
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
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
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
    // 40px on touch screens, 36px on lg+ (sized in liquid-top.css);
    // focus-visible draws a mint outline for keyboard users.
    className={`nm-icon-btn ${className}`}
  >
    {children}
  </button>
);

// Toolbar buttons act on the editor's current text selection, so a plain
// onClick would first steal focus from the editor and collapse that
// selection. preventDefault on mousedown keeps the selection alive through
// the click.
const keepSelection = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();

// Thin rule between groups — desktop only; phones rely on spacing.
const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`nm-tb-div hidden md:block ${className}`} aria-hidden="true" />
);

const Spinner = () => (
  <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
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
  // One flat row. DOM order is the desktop layout (tools left, actions
  // right); on phones `order-*` pulls the most used actions to the front
  // and the row scrolls sideways instead of wrapping. md:order-none
  // restores DOM order from tablet up.
  return (
    <div
      className="nm-tb absolute left-2 right-2 sm:left-3 sm:right-3 md:left-5 md:right-5 lg:left-7 lg:right-7 z-30 no-print"
    >
      <div className="nm-tb-row flex items-center gap-1.5 md:gap-1 p-[5px] overflow-x-auto">

        {/* Sidebar toggle */}
        <IconBtn
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Close Sidebar (⌘B)' : 'Open Sidebar (⌘B)'}
          className={`order-1 md:order-none ${sidebarOpen ? 'on' : ''}`}
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </IconBtn>

        <Divider />

        {/* Undo / Redo */}
        <div className="nm-tb-group order-4 md:order-none">
          <IconBtn onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo className="w-4 h-4" />
          </IconBtn>
          <IconBtn onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo className="w-4 h-4" />
          </IconBtn>
        </div>

        {/* Bold / Italic / Underline — only actionable while editing, so it
            only takes up space then. Mirrors Ctrl+B/I/U for touch users who
            have no keyboard shortcut. */}
        {isEditing && (
          <div className="nm-tb-group order-3 md:order-none">
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('bold')} title="Bold (Ctrl+B)">
              <Bold className="w-4 h-4" />
            </IconBtn>
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('italic')} title="Italic (Ctrl+I)">
              <Italic className="w-4 h-4" />
            </IconBtn>
            <IconBtn onMouseDown={keepSelection} onClick={() => execFormat('underline')} title="Underline (Ctrl+U)">
              <Underline className="w-4 h-4" />
            </IconBtn>
          </div>
        )}

        {/* Font size */}
        <div className="nm-tb-group order-9 md:order-none">
          <IconBtn onClick={handleZoomOut} title="Decrease Font (A-)">
            <Minus className="w-3.5 h-3.5" />
          </IconBtn>
          <span className="nm-tb-val">
            <Type className="w-3 h-3 md:hidden 2xl:block" />
            <span className="w-4 text-center">{fontSize}</span>
          </span>
          <IconBtn onClick={handleZoomIn} title="Increase Font (A+)">
            <Plus className="w-3.5 h-3.5" />
          </IconBtn>
        </div>

        {/* Line height */}
        <div className="nm-tb-group order-10 md:order-none">
          <IconBtn onClick={handleLineHeightDecrease} title="Tighter Spacing">
            <Minus className="w-3.5 h-3.5" />
          </IconBtn>
          <span className="nm-tb-val">
            <AlignJustify className="w-3 h-3 md:hidden 2xl:block" />
            <span className="w-6 text-center">{lineHeight.toFixed(1)}</span>
          </span>
          <IconBtn onClick={handleLineHeightIncrease} title="Looser Spacing">
            <Plus className="w-3.5 h-3.5" />
          </IconBtn>
        </div>

        {/* Pushes the actions to the right edge when there is room */}
        <div className="hidden md:block flex-1 min-w-2" aria-hidden="true" />

        {/* Dark mode */}
        <IconBtn
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          className="order-8 md:order-none"
        >
          {isDarkMode
            ? <Sun className="w-[18px] h-[18px]" />
            : <Moon className="w-[18px] h-[18px]" />
          }
        </IconBtn>

        <Divider />

        {/* Edit / Done / Rewrite */}
        {isEditing ? (
          <div className="flex gap-1.5 md:gap-1 flex-shrink-0 order-2 md:order-none">
            <button
              type="button"
              onClick={openSelectionRewriteModal}
              className="nm-btn nm-tb-pill accent"
              title="Rewrite selected text"
              aria-label="Rewrite selected text"
            >
              <Wand2 className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline md:hidden 2xl:inline">Rewrite</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); saveToStorage(); }}
              className="nm-chip on nm-tb-pill !px-3.5 justify-center"
              title="Done editing (Ctrl+E)"
              aria-label="Done editing (Ctrl+E)"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline md:hidden 2xl:inline">Done</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="nm-btn nm-tb-pill order-2 md:order-none"
            title="Edit document (Ctrl+E)"
            aria-label="Edit document (Ctrl+E)"
          >
            <PenTool className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline md:hidden 2xl:inline">Edit</span>
          </button>
        )}

        <Divider />

        {/* Index */}
        <button
          type="button"
          onClick={handleAddTableOfContents}
          className="nm-btn nm-tb-pill order-11 md:order-none"
          title="Toggle table of contents"
          aria-label="Toggle table of contents"
        >
          <ListOrdered className="w-4 h-4 flex-shrink-0" />
          <span className="hidden 2xl:inline">Index</span>
        </button>

        {/* Export via browser print dialog (fine control, needs pop-ups allowed) */}
        <button
          type="button"
          onClick={handleExportPDF}
          className="nm-btn nm-tb-pill order-7 md:order-none"
          title="Print / Export via browser (opens print dialog)"
          aria-label="Print / Export via browser (opens print dialog)"
        >
          <Printer className="w-4 h-4 flex-shrink-0" />
          <span className="hidden 2xl:inline">Print</span>
        </button>

        {/* Direct DOCX download — a real, editable Word document */}
        <button
          type="button"
          onClick={handleDownloadDocx}
          disabled={isDownloadingDocx}
          className="nm-btn nm-tb-pill order-6 md:order-none"
          title="Download as Word document (.docx)"
          aria-label="Download as Word document (.docx)"
        >
          {isDownloadingDocx ? <Spinner /> : <FileText className="w-4 h-4 flex-shrink-0" />}
          <span className="hidden sm:inline md:hidden 2xl:inline">{isDownloadingDocx ? 'Preparing…' : 'DOCX'}</span>
        </button>

        {/* Direct PDF download — no print dialog, saves straight to Downloads */}
        <button
          type="button"
          onClick={handleDownloadPdfDirect}
          disabled={isDownloadingPdf}
          className="nm-btn-primary nm-tb-pill order-3 md:order-none"
          title="Download as PDF (direct, no print dialog)"
          aria-label="Download as PDF (direct, no print dialog)"
        >
          {isDownloadingPdf ? <Spinner /> : <Download className="w-4 h-4 flex-shrink-0" />}
          <span className="hidden sm:inline">{isDownloadingPdf ? 'Preparing…' : 'Download'}</span>
        </button>
      </div>
    </div>
  );
};
