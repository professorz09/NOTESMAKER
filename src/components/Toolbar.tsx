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
  AlignJustify
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

export const Toolbar: React.FC<ToolbarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  fontSize,
  handleZoomOut,
  handleZoomIn,
  lineHeight,
  handleLineHeightIncrease,
  handleLineHeightDecrease,
  isEditing,
  setIsEditing,
  openSelectionRewriteModal,
  saveToStorage,
  handleExportPDF,
  handleAddTableOfContents,
  isDarkMode,
  toggleDarkMode
}) => {
  return (
    <div
      className="absolute top-0 left-0 right-0 md:top-4 md:left-6 md:right-6 lg:top-6 lg:left-8 lg:right-8 bg-white/97 dark:bg-slate-900/97 backdrop-blur-xl border-b md:border border-slate-200/60 dark:border-slate-700/60 md:rounded-2xl flex items-center justify-between px-2 sm:px-3 md:px-5 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.06)] z-30 transition-all"
      style={{
        height: '3.5rem',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >

      {/* LEFT: Sidebar toggle + Undo/Redo + Font size */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors group flex-shrink-0"
          title={sidebarOpen ? 'Close Sidebar (⌘B)' : 'Open Sidebar (⌘B)'}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className={`w-5 h-5 transition-all group-hover:scale-110 ${sidebarOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`} />
        </button>

        <div className="flex items-center gap-1">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Font size — hidden on xs, shown on sm+ */}
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all"
              title="Decrease Font Size"
              aria-label="Decrease font size"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-semibold w-5 text-center text-slate-600 dark:text-slate-300 select-none tabular-nums">{fontSize}</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all"
              title="Increase Font Size"
              aria-label="Increase font size"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Line height — hidden on xs, shown on md+ */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60" title="Line Spacing">
            <button
              onClick={handleLineHeightDecrease}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all"
              title="Decrease Line Spacing"
              aria-label="Decrease line spacing"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="flex items-center gap-0.5 px-0.5">
              <AlignJustify className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span className="text-xs font-semibold w-6 text-center text-slate-600 dark:text-slate-300 select-none tabular-nums">{lineHeight.toFixed(1)}</span>
            </span>
            <button
              onClick={handleLineHeightIncrease}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all"
              title="Increase Line Spacing"
              aria-label="Increase line spacing"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Dark mode + Edit/Done + Index + Export */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Dark mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
          title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode
            ? <Sun className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            : <Moon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          }
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0" />

        {/* Edit / Done / Rewrite */}
        {isEditing ? (
          <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
            <Button
              variant="ghost"
              onClick={openSelectionRewriteModal}
              className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-800/50 shadow-sm rounded-xl !px-2 sm:!px-2.5 !py-1.5 text-xs gap-1"
              title="Rewrite selected text"
            >
              <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Rewrite</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => { setIsEditing(false); saveToStorage(); }}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-500 shadow-emerald-500/20 rounded-xl !px-2 sm:!px-2.5 !py-1.5 text-xs gap-1"
              title="Done editing (Ctrl+E)"
            >
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Done</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 !px-2 sm:!px-2.5 !py-1.5 text-xs gap-1"
            title="Edit document (Ctrl+E)"
          >
            <PenTool className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        )}

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0" />

        {/* Add Index */}
        <Button
          variant="secondary"
          onClick={handleAddTableOfContents}
          className="hidden sm:flex bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 !px-2 md:!px-2.5 !py-1.5 text-xs gap-1"
          title="Toggle table of contents"
        >
          <ListOrdered className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline">Index</span>
        </Button>

        {/* Export PDF */}
        <Button
          variant="primary"
          onClick={handleExportPDF}
          className="shadow-blue-500/20 rounded-xl bg-blue-600 hover:bg-blue-700 !px-2 sm:!px-3 !py-1.5 text-xs gap-1"
          title="Export as PDF"
        >
          <Printer className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline">Export PDF</span>
        </Button>
      </div>
    </div>
  );
};
