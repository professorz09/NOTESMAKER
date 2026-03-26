import React from 'react';
import { Sparkles, Wand2, ArrowLeft } from 'lucide-react';
import { Button } from './Button';

interface RewriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewriteType: 'selection' | 'section';
  editTab: 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'table' | 'diagram';
  setEditTab: (tab: 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'table' | 'diagram') => void;
  rewriteModel: string;
  setRewriteModel: (model: string) => void;
  rewriteInstruction: string;
  setRewriteInstruction: (instruction: string) => void;
  isRewriting: boolean;
  handleRewriteSubmit: (e: React.FormEvent) => void;
  selectionText: string;
}

export const RewriteModal: React.FC<RewriteModalProps> = ({
  isOpen,
  onClose,
  rewriteType,
  editTab,
  setEditTab,
  rewriteModel,
  setRewriteModel,
  rewriteInstruction,
  setRewriteInstruction,
  isRewriting,
  handleRewriteSubmit,
  selectionText
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
       <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-0 overflow-hidden animate-in zoom-in duration-200 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
          <div className="bg-slate-50/80 dark:bg-slate-800/80 p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
             <h3 className="text-lg font-bold flex items-center gap-3 text-slate-800 dark:text-slate-100">
                {rewriteType === 'section' ? <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl"><Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400"/></div> : <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl"><Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400"/></div>}
                {rewriteType === 'section' ? 'Magic AI Editor' : 'Rewrite Selection'}
             </h3>
             <div className="flex items-center gap-3">
                <select 
                    value={rewriteModel}
                    onChange={(e) => setRewriteModel(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium shadow-sm"
                >
                    <option value="gemini-3-flash-preview">Flash (Fast)</option>
                    <option value="gemini-3.1-pro-preview">Pro (Deep)</option>
                </select>
                <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 p-2 rounded-xl transition-all"><ArrowLeft className="w-5 h-5 rotate-180" /></button>
             </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl mb-6 ring-1 ring-slate-200/50 dark:ring-slate-700/50 gap-1">
                {(['rewrite', 'expand', 'continue', 'next_topic', 'image', 'table', 'diagram'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setEditTab(tab)}
                        className={`flex-1 min-w-[20%] sm:min-w-0 py-2 px-1 text-[10px] sm:text-[11px] font-bold rounded-xl capitalize transition-all duration-200 ${editTab === tab ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 transform scale-[1.02] ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        {tab === 'expand' ? 'Deep Dive' : tab === 'continue' ? 'Continue' : tab === 'next_topic' ? 'Detailed Notes' : tab === 'image' ? 'Image' : tab === 'table' ? 'Compare Table' : tab === 'diagram' ? 'Diagram' : 'Refine'}
                    </button>
                ))}
            </div>
            
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                     <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Context</span>
                     <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">Preview</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 max-h-32 overflow-y-auto italic leading-relaxed">
                    "{rewriteType === 'section' ? "Selected Section Context..." : selectionText}"
                </div>
            </div>

            <form onSubmit={handleRewriteSubmit}>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Instructions</label>
                <input 
                type="text" 
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder={
                    editTab === 'expand' ? "e.g. Add 3 examples and a comparison table..." : 
                    editTab === 'image' ? "e.g. A detailed diagram of a cell structure..." :
                    editTab === 'next_topic' ? "e.g. The impact of economic reforms..." :
                    editTab === 'table' ? "e.g. Compare features of X and Y..." :
                    editTab === 'diagram' ? "e.g. Create a mindmap of this topic..." :
                    "e.g. Make it more professional..."
                }
                className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-8 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-shadow shadow-sm"
                autoFocus
                />
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isRewriting} className="border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300">Cancel</Button>
                    <Button 
                        type="submit" 
                        isLoading={isRewriting} 
                        className={`text-white shadow-lg rounded-xl ${
                            editTab === 'expand' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 
                            editTab === 'continue' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 
                            editTab === 'next_topic' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20' :
                            editTab === 'image' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' :
                            editTab === 'table' ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20' :
                            editTab === 'diagram' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' :
                            'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                        }`}
                    >
                        {
                            editTab === 'expand' ? 'Expand Content' : 
                            editTab === 'continue' ? 'Generate Next' : 
                            editTab === 'next_topic' ? 'Generate Detailed Notes' :
                            editTab === 'image' ? 'Create Illustration' :
                            editTab === 'table' ? 'Create Comparison Table' :
                            editTab === 'diagram' ? 'Create Diagram' :
                            'Apply Changes'
                        }
                    </Button>
                </div>
            </form>
          </div>
       </div>
    </div>
  );
};
