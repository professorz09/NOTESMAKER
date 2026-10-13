import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, Wand2, TableProperties, ImagePlus, X, Trash2, AlertTriangle, Minimize2, Maximize2, Globe2 } from 'lucide-react';
import { Button } from './Button';
import '../liquid-panels.css';

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
  rewriteGrounded: boolean;
  setRewriteGrounded: (grounded: boolean) => void;
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
  rewriteGrounded,
  setRewriteGrounded,
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
  const [minimized, setMinimized] = useState(false);

  // Auto-restore when rewriting completes
  useEffect(() => {
    if (!isRewriting) setMinimized(false);
  }, [isRewriting]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) { setConfirmRemove(false); setMinimized(false); }
  }, [isOpen]);

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

  // ── Minimized floating chip ──
  if (minimized && isRewriting) {
    const chipLabel = isExtendTable ? 'Extending table…' : 'Rewriting…';
    return (
      <div
        className="nm-raised nm-pop fixed right-4 z-[70] flex items-center gap-2.5 rounded-full pl-4 pr-1.5 py-1.5"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="nm-spinner" />
        <span className="nm-head text-sm font-semibold whitespace-nowrap">{chipLabel}</span>
        <button
          onClick={() => setMinimized(false)}
          className="nm-icon-btn !rounded-full"
          title="Restore"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const modelSelect = (
    <select
      value={rewriteModel}
      onChange={(e) => setRewriteModel(e.target.value)}
      className="nm-select min-w-0 max-w-[8.25rem] sm:max-w-[9.5rem]"
      disabled={isExtendTable ? undefined : isRewriting}
    >
      <option value="gemini-3.1-flash-lite">Flash Lite (Fast)</option>
      <option value="gemini-3.8-flash">Flash 3.8</option>
      <option value="gemini-3.1-pro-preview">Pro (Deep)</option>
    </select>
  );

  const headerActions = (
    <>
      {isRewriting && (
        <button
          onClick={() => setMinimized(true)}
          className="nm-icon-btn !rounded-full"
          title="Minimize — scroll document while waiting"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={onClose}
        disabled={isRewriting}
        className="nm-icon-btn !rounded-full"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </>
  );

  // ── Extend Table Mode ──
  if (isExtendTable) {
    return (
      <div
        className="nm-sheet-wrap nm-backdrop z-[60]"
        onClick={!isRewriting ? onClose : undefined}
        role="dialog"
        aria-modal="true"
        aria-label="Extend Table"
      >
        <div
          className="nm-sheet nm-sheet-b sm:max-w-md"
          onClick={e => e.stopPropagation()}
        >
          <div className="nm-sheet-grab" />
          <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-3 flex items-center justify-between gap-2">
            <h3 className="nm-head text-base font-bold flex items-center gap-2.5 min-w-0">
              <span className="nm-ico-badge">
                <TableProperties className="w-[18px] h-[18px]" />
              </span>
              <span className="truncate">Extend Table</span>
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {modelSelect}
              {headerActions}
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-5 pt-1 overflow-y-auto nm-scroll flex-1 min-h-0">
            <div className="mb-5">
              <span className="nm-label">Table Columns</span>
              <div className="nm-well mt-1.5 text-sm p-3 rounded-2xl font-medium leading-relaxed truncate">
                {extendHeadersPreview || 'Table context captured'}
              </div>
            </div>

            <form onSubmit={handleRewriteSubmit}>
              <label className="nm-head block text-sm font-semibold mb-2">
                Instruction <span className="nm-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder="e.g. Add more state examples, focus on economy…"
                className="nm-input mb-5 min-h-[46px]"
                autoFocus
                disabled={isRewriting}
              />
              <div className="flex justify-end gap-2.5">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isRewriting} className="flex-1 sm:flex-none min-h-[44px]">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isRewriting}
                  className="flex-1 sm:flex-none min-h-[44px] !px-5"
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
      className="nm-sheet-wrap nm-backdrop z-[60]"
      onClick={!isRewriting ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="AI Editor"
    >
      <div
        className="nm-sheet nm-sheet-b sm:max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="nm-sheet-grab" />
        {/* Header */}
        <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-3 flex items-center justify-between gap-2">
          <h3 className="nm-head text-base font-bold flex items-center gap-2.5 min-w-0">
            {rewriteType === 'section'
              ? <><span className="nm-ico-badge max-[400px]:!hidden"><Sparkles className="w-[18px] h-[18px]" /></span><span className="truncate">Magic AI Editor</span></>
              : <><span className="nm-ico-badge max-[400px]:!hidden"><Wand2 className="w-[18px] h-[18px]" /></span><span className="truncate">Rewrite Selection</span></>
            }
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {editTab !== 'image' && editTab !== 'diagram' && (
              <button
                type="button"
                onClick={() => setRewriteGrounded(!rewriteGrounded)}
                disabled={isRewriting}
                aria-pressed={rewriteGrounded}
                title={rewriteGrounded ? 'Google Grounding on — this edit uses live search' : 'Google Grounding off — turn on for live current facts'}
                className={`nm-icon-btn !rounded-full ${rewriteGrounded ? 'on' : ''}`}
              >
                <Globe2 className="w-4 h-4" />
              </button>
            )}
            {modelSelect}
            {headerActions}
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-5 pt-1 overflow-y-auto nm-scroll flex-1 min-h-0" style={{ maxHeight: '80vh' }}>
          {/* Edit tabs */}
          <div className="nm-seg !grid-flow-row grid-cols-3 sm:grid-cols-6 !rounded-[22px] sm:!rounded-full mb-5">
            {(['rewrite', 'expand', 'continue', 'next_topic', 'image', 'diagram'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setEditTab(tab)}
                disabled={isRewriting}
                aria-pressed={editTab === tab}
                className="nm-focus !px-1 !text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tab === 'expand' ? 'Deep Dive' : tab === 'continue' ? 'Continue' : tab === 'next_topic' ? 'Notes' : tab === 'image' ? 'Image' : tab === 'diagram' ? 'Diagram' : 'Refine'}
              </button>
            ))}
          </div>

          {/* Context preview */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="nm-label">Context</span>
              <span className="nm-badge">Preview</span>
            </div>
            <div className="nm-well nm-scroll text-xs p-3 rounded-2xl max-h-24 overflow-y-auto italic leading-relaxed">
              "{rewriteType === 'section' ? 'Selected section…' : selectionText}"
            </div>
          </div>

          <form onSubmit={handleRewriteSubmit}>
            {/* Instruction label + image attach */}
            <div className="flex items-center justify-between mb-2">
              <label className="nm-head text-sm font-semibold">Instructions</label>
              <div className="flex items-center gap-1.5">
                {modalImages.length > 0 && (
                  <span className="nm-badge">{modalImages.length} image{modalImages.length > 1 ? 's' : ''}</span>
                )}
                <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleImageAttach} className="hidden" />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  title="Attach image for AI reference"
                  disabled={isRewriting}
                  className={`nm-icon-btn !rounded-full ${modalImages.length > 0 ? 'on' : ''}`}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Attached images */}
            {modalImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {modalImages.map((img, idx) => (
                  <div key={idx} className="relative group w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--nm-line)' }}>
                    <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center"
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
              className="nm-input mb-5 min-h-[46px]"
              autoFocus
              disabled={isRewriting}
            />

            {/* Footer */}
            <div className="flex flex-wrap justify-between items-center gap-2.5 pt-4 border-t" style={{ borderColor: 'var(--nm-line)' }}>
              {/* Section remove */}
              {rewriteType === 'section' && handleSectionRemove ? (
                confirmRemove ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Remove section?
                    </span>
                    <button
                      type="button"
                      onClick={handleSectionRemove}
                      disabled={isRewriting}
                      className="nm-btn-danger-solid px-3.5 min-h-[40px] text-xs"
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="nm-btn px-3.5 min-h-[40px] text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={isRewriting}
                    className="nm-btn danger px-3.5 min-h-[44px] text-xs"
                    title="Remove selected section"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )
              ) : <span />}

              <div className="flex gap-2.5 ml-auto">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isRewriting}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isRewriting}
                  className="min-h-[44px] !px-5"
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
