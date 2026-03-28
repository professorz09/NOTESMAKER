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
  ListOrdered
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
    <div className="absolute top-0 left-0 right-0 md:top-6 md:left-8 md:right-8 h-14 md:h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b md:border border-slate-200/60 dark:border-slate-700/60 md:rounded-2xl flex items-center justify-between px-2 md:px-6 shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] z-30 transition-all">
         <div className="flex items-center gap-1 md:gap-4">
             {!sidebarOpen && (
                <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 md:-ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors group"
                title="Open Sidebar"
                >
                    <PanelLeft className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                </button>
             )}
             <div className="flex items-center gap-1 md:gap-2">
                <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg md:rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
                    <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 md:p-2 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Undo className="w-4 h-4"/></button>
                    <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="p-1.5 md:p-2 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-all"><Redo className="w-4 h-4"/></button>
                </div>
                
                {/* FONT SIZE CONTROLS - Hidden on mobile to save space */}
                <div className="hidden sm:flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60 ml-1">
                    <button onClick={handleZoomOut} className="p-1.5 md:p-2 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all" title="Decrease Font Size">
                        <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-semibold w-5 md:w-6 text-center text-slate-600 dark:text-slate-300 select-none">{fontSize}</span>
                    <button onClick={handleZoomIn} className="p-1.5 md:p-2 rounded-md hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 transition-all" title="Increase Font Size">
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
             </div>
         </div>

         <div className="flex items-center gap-1 md:gap-3 ml-auto">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className="h-5 md:h-6 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 md:mx-1"></div>

            {isEditing ? (
              <div className="flex gap-1 md:gap-2 animate-in fade-in zoom-in duration-200">
                 <Button variant="ghost" onClick={openSelectionRewriteModal} className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-800/50 shadow-sm rounded-lg md:rounded-xl !px-2 md:!px-4 !py-1.5 md:!py-2 text-xs md:text-sm">
                    <Wand2 className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Rewrite</span>
                 </Button>
                 <Button variant="primary" onClick={() => { setIsEditing(false); saveToStorage(); }} className="bg-emerald-600 hover:bg-emerald-700 border-emerald-500 shadow-emerald-500/20 rounded-lg md:rounded-xl !px-2 md:!px-4 !py-1.5 md:!py-2 text-xs md:text-sm">
                    <Check className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Done</span>
                 </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setIsEditing(true)} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 rounded-lg md:rounded-xl text-slate-700 dark:text-slate-200 !px-2 md:!px-4 !py-1.5 md:!py-2 text-xs md:text-sm">
                <PenTool className="w-4 h-4 md:mr-2 text-slate-500 dark:text-slate-400" /> <span className="hidden md:inline">Edit</span>
              </Button>
            )}
            
            <div className="h-5 md:h-6 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 md:mx-1"></div>
            
            <Button variant="secondary" onClick={handleAddTableOfContents} className="hidden sm:flex bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 rounded-lg md:rounded-xl text-slate-700 dark:text-slate-200 !px-2 md:!px-4 !py-1.5 md:!py-2 text-xs md:text-sm">
               <ListOrdered className="w-4 h-4 md:mr-2 text-slate-500 dark:text-slate-400" /> <span className="hidden md:inline">Add Index</span>
            </Button>
            
            <Button variant="primary" onClick={handleExportPDF} className="shadow-blue-500/20 rounded-lg md:rounded-xl bg-blue-600 hover:bg-blue-700 !px-2 md:!px-4 !py-1.5 md:!py-2 text-xs md:text-sm">
               <Printer className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Export PDF</span>
            </Button>
         </div>
     </div>
  );
};
