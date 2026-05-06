import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, Wand2, TableProperties, ImagePlus, X, Trash2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface RewriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isExtendTable?: boolean;
  extendHeadersPreview?: string;
  rewriteType: 'selection' | 'section';
  editTab: 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'diagram' | 'table';
  setEditTab: (tab: 'rewrite' | 'expand' | 'continue' | 'next_topic' | 'image' | 'diagram' | 'table') => void;
  rewriteModel: string;
  setRewriteModel: (model: string) => void;
  rewriteInstruction: string;
  setRewriteInstruction: (instruction: string) => void;
  isRewriting: boolean;
  handleRewriteSubmit: (e: React.FormEvent) => void;
  handleSectionRemove?: () => void;
  selectionText: string;
  modalImages: { base64: string; mimeType: string; dataUrl: string }[];
  setModalImages: (imgs: { base64: string; mimeType: string; dataUrl: string }[]) => void;
}

export const RewriteModal: React.FC<RewriteModalProps> = ({
  isOpen,
  onClose,
  isExtendTable = false,
  extendHeadersPreview = '',
  rewriteType,
  editTab,
  setEditTab,
  rewriteModel,
  setRewriteModel,
  rewriteInstruction,
  setRewriteInstruction,
  isRewriting,
  handleRewriteSubmit,
  handleSectionRemove,
  selectionText,
  modalImages,
  setModalImages,
}) => {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Escape key closes modal (unless rewriting)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRewriting) {
        if (confirmRemove) { setConfirmRemove(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isRewriting, onClose, confirmRemove]);

  // Reset confirm state when modal closes
  useEffect(() => {
    if (!isOpen) setConfirmRemove(false);
  }, [isOpen]);

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const promises = Array.from(files).map(
      file => new Promise<{ base64: string; mimeType: string; dataUrl: string }>(resolve => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          resolve({ base64: dataUrl.split(',')[1], mimeType: file.type, dataUrl });
        };
        reader.readAsDataURL(file);
      })
    );
    Promise.all(promises).then(newImgs => {
      setModalImages([...modalImages, ...newImgs]);
    });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setModalImages(modalImages.filter((_, i) => i !== idx));
  };

  if (!isOpen) return null;

  // ── Extend Table Mode ──
  if (isExtendTable) {
    return (
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
        onClick={!isRewriting ? onClose : undefined}
        role="dialog"
        aria-modal="true"
        aria-label="Extend Table"
      >
        <div
          className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-0 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ring-1 ring-slate-200/50 dark:ring-slate-700/50"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-teal-50/80 dark:bg-teal-900/30 px-5 py-4 border-b border-teal-100 dark:border-teal-800/40 flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2.5 text-slate-800 dark:text-slate-100">
              <div className="p-1.5 bg-teal-100 dark:bg-teal-900/60 rounded-xl">
                <TableProperties className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              Extend Table
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={rewriteModel}
                onChange={(e) => setRewriteModel(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-1.5 font-medium shadow-sm"
              >
                <option value="gemini-3-flash-preview">Flash (Fast)</option>
                <option value="gemini-3.1-pro-preview">Pro (Deep)</option>
              </select>
              <button
                onClick={onClose}
                disabled={isRewriting}
                className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-30"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-5">
              <span className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-widest">Table Columns</span>
              <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 bg-teal-50/60 dark:bg-teal-900/20 p-3 rounded-2xl border border-teal-100 dark:border-teal-800/40 font-medium leading-relaxed truncate">
                {extendHeadersPreview || 'Table context captured'}
              </div>
            </div>

            <form onSubmit={handleRewriteSubmit}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Instruction <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder="e.g. Add more state examples, focus on economy…"
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 mb-5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-shadow text-sm"
                autoFocus
                disabled={isRewriting}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isRewriting} className="border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-sm">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isRewriting}
                  className="bg-teal-600 hover:bg-teal-700 shadow-teal-500/20 text-white shadow-md rounded-xl text-sm"
                >
                  Add Rows
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main AI Editor Modal ──
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/80 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
      onClick={!isRewriting ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="AI Editor"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg p-0 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ring-1 ring-slate-200/50 dark:ring-slate-700/50"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50/80 dark:bg-slate-800/80 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2.5 text-slate-800 dark:text-slate-100">
            {rewriteType === 'section'
              ? <><div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl"><Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>Magic AI Editor</>
              : <><div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl"><Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>Rewrite Selection</>
            }
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={rewriteModel}
              onChange={(e) => setRewriteModel(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium shadow-sm"
              disabled={isRewriting}
            >
              <option value="gemini-3-flash-preview">Flash (Fast)</option>
              <option value="gemini-3.1-pro-preview">Pro (Deep)</option>
            </select>
            <button
              onClick={onClose}
              disabled={isRewriting}
              className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all disabled:opacity-30"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>
          {/* Edit tabs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl mb-5 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
            {(['rewrite', 'expand', 'continue', 'next_topic', 'image', 'diagram'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setEditTab(tab)}
                disabled={isRewriting}
                className={`py-2 px-1 text-[10px] sm:text-[11px] font-bold rounded-xl capitalize transition-all duration-200 ${
                  editTab === tab
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 ring-1 ring-slate-200/50 dark:ring-slate-600/50'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50'
                }`}
              >
                {tab === 'expand' ? 'Deep Dive' : tab === 'continue' ? 'Continue' : tab === 'next_topic' ? 'Notes' : tab === 'image' ? 'Image' : tab === 'diagram' ? 'Diagram' : 'Refine'}
              </button>
            ))}
          </div>

          {/* Context preview */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Context</span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">Preview</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 max-h-24 overflow-y-auto italic leading-relaxed">
              "{rewriteType === 'section' ? 'Selected section…' : selectionText}"
            </div>
          </div>

          <form onSubmit={handleRewriteSubmit}>
            {/* Instruction label + image attach */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Instructions</label>
              <div className="flex items-center gap-1.5">
                {modalImages.length > 0 && (
                  <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">{modalImages.length} image{modalImages.length > 1 ? 's' : ''}</span>
                )}
                <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleImageAttach} className="hidden" />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  title="Attach image for AI reference"
                  disabled={isRewriting}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    modalImages.length > 0
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-500 dark:hover:text-blue-400'
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Attached images */}
            {modalImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {modalImages.map((img, idx) => (
                  <div key={idx} className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              value={rewriteInstruction}
              onChange={(e) => setRewriteInstruction(e.target.value)}
              placeholder={
                editTab === 'expand'     ? 'e.g. Add 3 examples and a comparison table…' :
                editTab === 'image'      ? 'e.g. A detailed diagram of cell structure…' :
                editTab === 'next_topic' ? 'e.g. The impact of economic reforms…' :
                editTab === 'diagram'    ? 'e.g. Mindmap / flowchart of this topic…' :
                editTab === 'continue'   ? 'e.g. Continue with the next sub-point…' :
                'e.g. Make it more concise and professional…'
              }
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-5 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-shadow text-sm shadow-sm"
              autoFocus
              disabled={isRewriting}
            />

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Section remove */}
              {rewriteType === 'section' && handleSectionRemove ? (
                confirmRemove ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Remove section?
                    </span>
                    <button
                      type="button"
                      onClick={handleSectionRemove}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={isRewriting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-40"
                    title="Remove selected section"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )
              ) : <span />}

              <div className="flex gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isRewriting}
                  className="border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isRewriting}
                  className={`text-white shadow-lg rounded-xl text-sm ${
                    editTab === 'expand'     ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' :
                    editTab === 'continue'   ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' :
                    editTab === 'next_topic' ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20' :
                    editTab === 'image'      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' :
                    editTab === 'diagram'    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' :
                    'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                  }`}
                >
                  {editTab === 'expand'     ? 'Expand' :
                   editTab === 'continue'   ? 'Generate Next' :
                   editTab === 'next_topic' ? 'Generate Notes' :
                   editTab === 'image'      ? 'Create Illustration' :
                   editTab === 'diagram'    ? 'Create Diagram' :
                   'Apply Changes'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
