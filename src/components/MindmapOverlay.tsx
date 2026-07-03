import React from 'react';
import { Check, RotateCw, SkipForward, Loader2, AlertTriangle, Circle, Minus } from 'lucide-react';
import type { MindmapState, MindmapNode, MindmapNodeStatus } from '../types';

interface MindmapOverlayProps {
  mindmap: MindmapState;
  onRetry: () => void;
  onSkip: () => void;
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

const NodeRow: React.FC<{ node: MindmapNode; onRetry: () => void; onSkip: () => void }> = ({ node, onRetry, onSkip }) => {
  const meta = STATUS_META[node.status];
  return (
    <div className="relative pl-6">
      {/* connector from the spine to this node */}
      <span className="absolute left-0 top-[18px] w-6 h-px bg-slate-200 dark:bg-slate-700" />
      <span className={`absolute left-[-4px] top-[13px] w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-900 ${meta.dot} ${node.status === 'active' ? 'border-indigo-400' : node.status === 'done' ? 'border-emerald-400' : node.status === 'error' ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}`} />

      <div className={`rounded-xl border bg-white dark:bg-slate-800/80 px-3 py-2 transition-all ${meta.ring} ${node.status === 'active' ? 'scale-[1.01]' : ''}`}>
        <div className="flex items-center gap-2">
          <StatusIcon status={node.status} />
          <span className={`text-[13px] font-semibold flex-1 min-w-0 ${node.status === 'skipped' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-100'}`}>
            {node.label}
          </span>
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

        {node.status === 'error' && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] flex-1 sm:flex-none rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </button>
            <button
              onClick={onSkip}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] flex-1 sm:flex-none rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const MindmapOverlay: React.FC<MindmapOverlayProps> = ({ mindmap, onRetry, onSkip }) => {
  const total = mindmap.nodes.length || 1;
  const settled = mindmap.nodes.filter((n) => n.status === 'done' || n.status === 'skipped').length;
  const pct = Math.round((settled / total) * 100);

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
              <div className="text-white font-black text-lg leading-none tabular-nums">{pct}%</div>
              <div className="text-[10px] text-indigo-200">{settled}/{total}</div>
            </div>
          </div>
          <div className="mt-2.5 w-full bg-white/25 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full bg-white transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>

        {/* central topic node */}
        <div className="px-4 sm:px-5 pt-4">
          <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-300/50 dark:border-indigo-700/50 px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[13px] font-black text-slate-800 dark:text-slate-100">{mindmap.title}</span>
          </div>
        </div>

        {/* branches (left-spine tree) */}
        <div className="px-4 sm:px-5 py-3">
          <div className="relative ml-2 pl-0 space-y-2 border-l-2 border-slate-200 dark:border-slate-700">
            {mindmap.nodes.length === 0 ? (
              <div className="pl-6 py-3 flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Topic का structure बन रहा है…
              </div>
            ) : (
              mindmap.nodes.map((node) => (
                <NodeRow key={node.id} node={node} onRetry={onRetry} onSkip={onSkip} />
              ))
            )}
          </div>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 text-center">
          <p className="text-[10px] text-slate-400">
            {mindmap.errorNodeId
              ? '⚠️ एक भाग में समस्या — Retry या Skip चुनें'
              : 'Notes नीचे live बन रहे हैं • generation पूरा होते ही दिखेंगे'}
          </p>
        </div>
      </div>
    </div>
  );
};
