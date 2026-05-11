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
  Moon,
  Sun,
  ListOrdered,
  AlignJustify,
  Type,
} from 'lucide-react';
import { Button } from './Button';

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
  openSelectionRewriteModal: () => void;
  saveToStorage: () => void;
  handleExportPDF: () => void;
  handleAddTableOfContents: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const IconBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, title, className = '', children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 ${className}`}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0" />
);

export const Toolbar: React.FC<ToolbarProps> = ({
  sidebarOpen, setSidebarOpen,
  handleUndo, handleRedo, canUndo, canRedo,
  fontSize, handleZoomOut, handleZoomIn,
  lineHeight, handleLineHeightIncrease, handleLineHeightDecrease,
  isEditing, setIsEditing,
  openSelectionRewriteModal, saveToStorage,
  handleExportPDF, handleAddTableOfContents,
  isDarkMode, toggleDarkMode,
}) => {
  return (
    <div
      className="absolute top-0 left-0 right-0 sm:top-2.5 sm:left-3 sm:right-3 md:top-3.5 md:left-5 md:right-5 lg:top-4 lg:left-7 lg:right-7
        bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl
        border-b sm:border border-slate-200/70 dark:border-slate-700/70
        sm:rounded-2xl
        flex items-center justify-between
        px-2 sm:px-3
        shadow-[0_1px_3px_rgb(0,0,0,0.06)] sm:shadow-[0_4px_24px_rgb(0,0,0,0.07)]
        z-30 transition-all duration-300"
      style={{ height: '3.25rem', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ── LEFT ── */}
      <div className="flex items-center gap-1 sm:gap-1.5">

        {/* Sidebar toggle */}
        <IconBtn
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? 'Close Sidebar (⌘B)' : 'Open Sidebar (⌘B)'}
          className={`${sidebarOpen ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}`}
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </IconBtn>

        <Divider />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/60 dark:border-slate-700/60">
          <IconBtn onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo className="w-3.5 h-3.5" />
          </IconBtn>
        </div>

        {/* Font size — visible on sm+, compact on mobile */}
        <div className="hidden xs:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/60 dark:border-slate-700/60">
          <IconBtn onClick={handleZoomOut} title="Decrease Font (A-)">
            <Minus className="w-3 h-3" />
          </IconBtn>
          <span className="flex items-center gap-0.5 px-0.5 select-none">
            <Type className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span className="text-xs font-semibold w-4 text-center text-slate-600 dark:text-slate-300 tabular-nums">{fontSize}</span>
          </span>
          <IconBtn onClick={handleZoomIn} title="Increase Font (A+)">
            <Plus className="w-3 h-3" />
          </IconBtn>
        </div>

        {/* Line height — md+ */}
        <div className="hidden md:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/60 dark:border-slate-700/60">
          <IconBtn onClick={handleLineHeightDecrease} title="Tighter Spacing">
            <Minus className="w-3 h-3" />
          </IconBtn>
          <span className="flex items-center gap-0.5 px-0.5 select-none">
            <AlignJustify className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span className="text-xs font-semibold w-6 text-center text-slate-600 dark:text-slate-300 tabular-nums">{lineHeight.toFixed(1)}</span>
          </span>
          <IconBtn onClick={handleLineHeightIncrease} title="Looser Spacing">
            <Plus className="w-3 h-3" />
          </IconBtn>
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-1 sm:gap-1.5">

        {/* Dark mode */}
        <IconBtn onClick={toggleDarkMode} title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
          {isDarkMode
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </IconBtn>

        <Divider />

        {/* Edit / Done / Rewrite */}
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              onClick={openSelectionRewriteModal}
              className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800/50 shadow-sm rounded-xl !px-2 sm:!px-2.5 !py-1.5 text-xs gap-1"
              title="Rewrite selected text"
            >
              <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-semibold">Rewrite</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => { setIsEditing(false); saveToStorage(); }}
              className="bg-emerald-500 hover:bg-emerald-600 border-emerald-400 shadow-emerald-500/25 rounded-xl !px-2 sm:!px-3 !py-1.5 text-xs gap-1"
              title="Done editing (Ctrl+E)"
            >
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-semibold">Done</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-slate-600 dark:text-slate-300 !px-2 sm:!px-2.5 !py-1.5 text-xs gap-1 transition-colors"
            title="Edit document (Ctrl+E)"
          >
            <PenTool className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline font-semibold">Edit</span>
          </Button>
        )}

        <Divider />

        {/* Index — sm+ */}
        <Button
          variant="secondary"
          onClick={handleAddTableOfContents}
          className="hidden sm:flex bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-slate-600 dark:text-slate-200 !px-2 md:!px-2.5 !py-1.5 text-xs gap-1"
          title="Toggle table of contents"
        >
          <ListOrdered className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline font-semibold">Index</span>
        </Button>

        {/* Export PDF */}
        <Button
          variant="primary"
          onClick={handleExportPDF}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 shadow-md !px-2.5 sm:!px-3.5 !py-1.5 text-xs gap-1.5"
          title="Export as PDF"
        >
          <Printer className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline font-semibold">Export</span>
        </Button>
      </div>
    </div>
  );
};
