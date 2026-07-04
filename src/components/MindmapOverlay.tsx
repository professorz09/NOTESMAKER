import React, { useState, useRef, useEffect } from 'react';
import { Check, RotateCw, SkipForward, FastForward, Loader2, AlertTriangle, Circle, Minus, Sparkles, Plus, PartyPopper, Wand2, X } from 'lucide-react';
import type { MindmapState, MindmapNode, MindmapNodeStatus } from '../types';

interface MindmapOverlayProps {
  mindmap: MindmapState;
  onRetry: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNodeClick: (nodeId: string, instruction?: string) => void;
  onSetNodeInstruction: (nodeId: string, text: string) => void;
  onApprove: () => void;
  onAddMore: (text: string) => void;
  onDone: () => void;
}

const STATUS_META: Record<MindmapNodeStatus, { ring: string; dot: string }> = {
  pending: { ring: 'border-slate-300 dark:border-slate-600', dot: 'text-slate-400' },
  active:  { ring: 'border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.18)]', dot: 'text-indigo-500' },
  done:    { ring: 'border-emerald-400', dot: 'text-emerald-500' },
  error:   { ring: 'border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]', dot: 'text-red-500' },
  skipped: { ring: 'border-slate-300 dark:border-slate-700 opacity-60', dot: 'text-slate-400' },
};

const StatusIcon: React.FC<{ status: MindmapNodeStatus }> = ({ status }) => {
  if (status === 'active') return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />;
  if (status === 'done') return <Check className="w-4 h-4 text-emerald-500" />;
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (status === 'skipped') return <Minus className="w-4 h-4 text-slate-400" />;
  return <Circle className="w-3.5 h-3.5 text-slate-400" />;
};

const CLICKABLE_HINT: Partial<Record<MindmapNodeStatus, string>> = {
  done: 'Click to improve this draft (optionally with an instruction)',
  error: 'Click to try again',
  skipped: 'Click to generate now',
};

const NodeRow: React.FC<{
  node: MindmapNode;
  awaitingApproval?: boolean;
  onRetry: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNodeClick: (nodeId: string, instruction?: string) => void;
  onSetInstruction?: (nodeId: string, text: string) => void;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ node, awaitingApproval, onRetry, onSkip, onFinish, onNodeClick, onSetInstruction, innerRef }) => {
  const meta = STATUS_META[node.status];
  // During the review step every node is clickable to attach an instruction;
  // otherwise only settled nodes are clickable to regenerate/deepen.
  const instructionMode = !!awaitingApproval;
  const clickable = instructionMode || node.status === 'done' || node.status === 'skipped';
  const hint = instructionMode ? 'Click to add an instruction for this section' : CLICKABLE_HINT[node.status];
  const [panelOpen, setPanelOpen] = useState(false);
  const [instruction, setInstruction] = useState('');

  const closePanel = () => { setPanelOpen(false); setInstruction(''); };
  const submitPanel = () => {
    if (instructionMode) onSetInstruction?.(node.id, instruction);
    else onNodeClick(node.id, instruction.trim() || undefined);
    closePanel();
  };
  const openPanel = clickable && !panelOpen
    ? () => { setInstruction(instructionMode ? (node.instruction || '') : ''); setPanelOpen(true); }
    : undefined;

  return (
    <div ref={innerRef} className="relative pl-6 scroll-mt-2">
      {/* connector from the spine to this node */}
      <span className="absolute left-0 top-[18px] w-6 h-px bg-slate-200 dark:bg-slate-700" />
      <span className={`absolute left-[-4px] top-[13px] w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-900 ${meta.dot} ${node.status === 'active' ? 'border-indigo-400' : node.status === 'done' ? 'border-emerald-400' : node.status === 'error' ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />

      <div
        onClick={openPanel}
        role={openPanel ? 'button' : undefined}
        tabIndex={openPanel ? 0 : undefined}
        onKeyDown={openPanel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); } } : undefined}
        title={hint}
        className={`rounded-xl border bg-white dark:bg-slate-800/80 px-3 py-2 transition-all ${meta.ring} ${node.status === 'active' ? 'scale-[1.01]' : ''} ${clickable && !panelOpen ? 'cursor-pointer hover:border-indigo-400 hover:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] active:scale-[0.99] focus-visible:outline-none focus-visible:border-indigo-400 focus-visible:shadow-[0_0_0_3px_rgba(99,102,241,0.25)]' : ''}`}
      >
        <div className="flex items-center gap-2">
          <StatusIcon status={node.status} />
          <span className={`text-[13px] font-semibold flex-1 min-w-0 ${node.status === 'skipped' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-100'}`}>
            {node.label}
          </span>
          {instructionMode
            ? <Wand2 className={`w-3.5 h-3.5 flex-shrink-0 ${node.instruction ? 'text-indigo-500' : 'text-slate-400'}`} />
            : clickable && <Sparkles className="w-3 h-3 text-indigo-400/70 flex-shrink-0" />}
        </div>

        {node.children.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pl-6">
            {node.children.map((c) => (
              <span
                key={c.id}
                className={`text-[10px] px-1.5 py-0.5 rounded-md border ${
                  node.status === 'done'
                    ? 'border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                    : node.status === 'active'
                      ? 'border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Saved review-instruction badge (approval step, panel closed). */}
        {instructionMode && node.instruction && !panelOpen && (
          <div className="flex items-start gap-1.5 mt-1.5 pl-6 text-[10.5px] text-indigo-600 dark:text-indigo-300">
            <Wand2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="italic">{node.instruction}</span>
          </div>
        )}

        {/* Instruction / improve panel. During review it attaches a per-section
            instruction; after generation it refines the existing draft. */}
        {panelOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-1.5">
              <Wand2 className="w-3 h-3" /> {instructionMode ? 'Instruction for this section (optional)' : 'Optional — how should it be improved?'}
            </label>
            <textarea
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitPanel(); } if (e.key === 'Escape') closePanel(); }}
              placeholder={instructionMode
                ? 'e.g. focus on current examples, keep it concise, add a comparison table…'
                : 'e.g. add a real example, make a table, explain more simply… (leave empty to just regenerate in more depth)'}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 resize-none transition-all"
            />
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={submitPanel}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[36px] flex-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" /> {instructionMode ? 'Save' : (node.status === 'skipped' ? 'Generate' : 'Regenerate')}
              </button>
              <button
                onClick={closePanel}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {node.status === 'error' && (
          <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] flex-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </button>
            <button
              onClick={onSkip}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] flex-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
            <button
              onClick={onFinish}
              title="Finish now with the notes already generated"
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[38px] flex-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95 transition-all"
            >
              <FastForward className="w-3.5 h-3.5" /> Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const MindmapOverlay: React.FC<MindmapOverlayProps> = ({
  mindmap, onRetry, onSkip, onFinish, onNodeClick, onSetNodeInstruction, onApprove, onAddMore, onDone,
}) => {
  const [addText, setAddText] = useState('');
  const awaiting = mindmap.awaitingApproval;
  const total = mindmap.nodes.length || 1;
  const settled = mindmap.nodes.filter((n) => n.status === 'done' || n.status === 'skipped').length;
  const pct = Math.round((settled / total) * 100);

  // Keep the node currently being worked on (or the one paused on an error)
  // in view. On a Deep-level map with many sections the active node scrolls
  // below the fold, so the user loses sight of live progress without this.
  const activeNodeId = mindmap.nodes.find((n) => n.status === 'active')?.id ?? mindmap.errorNodeId;
  const activeNodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeNodeId && activeNodeRef.current) {
      activeNodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeNodeId]);

  const submitAdd = () => {
    const text = addText.trim();
    if (!text || mindmap.addBusy) return;
    onAddMore(text);
    setAddText('');
  };

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto p-3 sm:p-6 pt-[4.75rem] sm:pt-24 pb-8 bg-slate-50/85 dark:bg-slate-950/85 backdrop-blur-sm">
      <div className="w-full max-w-[640px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        {/* header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">{mindmap.subtitle}</p>
              <h3 className="text-white font-bold text-sm sm:text-base truncate">{mindmap.title}</h3>
            </div>
            <div className="text-right flex-shrink-0">
              {awaiting
                ? <div className="text-white font-bold text-[11px] leading-tight">Review<br/>the plan</div>
                : <><div className="text-white font-black text-lg leading-none tabular-nums">{pct}%</div>
                    <div className="text-[10px] text-indigo-200">{settled}/{total}</div></>}
            </div>
          </div>
          {!awaiting && (
            <div className="mt-2.5 w-full bg-white/25 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-white transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
            </div>
          )}
          {awaiting && (
            <p className="mt-2 text-[10.5px] text-indigo-100 leading-snug">
              Tap any topic to add an instruction for it (optional), add points below, then press <strong>Approve &amp; Generate</strong>.
            </p>
          )}
        </div>

        {/* central topic node */}
        <div className="px-4 sm:px-5 pt-4">
          <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-300/50 dark:border-indigo-700/50 px-3 py-2">
            <span className={`w-2 h-2 rounded-full bg-indigo-500 ${mindmap.complete ? '' : 'animate-pulse'}`} />
            <span className="text-[13px] font-black text-slate-800 dark:text-slate-100">{mindmap.title}</span>
          </div>
        </div>

        {/* branches (left-spine tree) — the "add a point" row lives on the
            same spine as the last node, so it reads as part of the map
            rather than a separate bar stuck to the bottom. */}
        <div className="px-4 sm:px-5 py-3 max-h-[52vh] overflow-y-auto scrollbar-thin">
          <div className="relative ml-2 pl-0 space-y-2 border-l-2 border-slate-200 dark:border-slate-700">
            {mindmap.nodes.length === 0 ? (
              <div className="pl-6 py-3 flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Building the structure…
              </div>
            ) : (
              mindmap.nodes.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  awaitingApproval={awaiting}
                  innerRef={node.id === activeNodeId ? activeNodeRef : undefined}
                  onRetry={onRetry}
                  onSkip={onSkip}
                  onFinish={onFinish}
                  onNodeClick={onNodeClick}
                  onSetInstruction={onSetNodeInstruction}
                />
              ))
            )}

            {/* Add-a-point node — same card background as the real nodes so
                it reads as part of the map; a dashed border + dashed dot are
                the only cue that it's an "add" affordance. */}
            <div className="relative pl-6">
              <span className="absolute left-0 top-[22px] w-6 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="absolute left-[-5px] top-[16px] w-3 h-3 rounded-full border-2 border-dashed border-indigo-400 bg-white dark:bg-slate-900" />
              <div className="rounded-xl border border-dashed border-indigo-300/70 dark:border-indigo-600/50 bg-white dark:bg-slate-800/80 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
                    placeholder="Add another topic / heading…"
                    disabled={mindmap.addBusy}
                    className="flex-1 min-w-0 bg-transparent border-none px-1 py-1 text-[13px] font-semibold text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    onClick={submitAdd}
                    disabled={mindmap.addBusy || !addText.trim()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all flex-shrink-0"
                  >
                    {mindmap.addBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span className="hidden xs:inline">Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          {awaiting ? (
            <button
              onClick={onApprove}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/25"
            >
              <Sparkles className="w-4 h-4" /> Approve &amp; Generate
            </button>
          ) : mindmap.complete ? (
            <button
              onClick={onDone}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/20"
            >
              <PartyPopper className="w-4 h-4" /> Done — View Notes
            </button>
          ) : (
            <p className="text-center text-[10px] text-slate-400">
              {mindmap.errorNodeId
                ? '⚠️ A section ran into a problem — choose Retry, Skip or Finish'
                : 'Notes are being written live below • the Done button appears once generation finishes'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
