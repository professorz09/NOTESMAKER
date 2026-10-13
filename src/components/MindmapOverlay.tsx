import React, { useState, useRef, useEffect } from 'react';
import { Check, RotateCw, SkipForward, FastForward, Loader2, AlertTriangle, Minus, Sparkles, Plus, PartyPopper, Wand2, X, Shuffle, ListTree, Eye } from 'lucide-react';
import type { MindmapState, MindmapNode, MindmapNodeStatus } from '../types';
import '../liquid-panels.css';
import '../liquid-plan.css';

interface MindmapOverlayProps {
  mindmap: MindmapState;
  onRetry: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNodeClick: (nodeId: string, instruction?: string) => void;
  onSetNodeInstruction: (nodeId: string, text: string) => void;
  onApprove: () => void;
  onRestructure: () => void;
  onCompareApply: () => void;
  onCompareDiscard: () => void;
  onAddMore: (text: string) => void;
  onDone: () => void;
  // Hides the sheet so the notes being written behind it can be read; the
  // progress pill offers a way back.
  onMinimize?: () => void;
}

const STATUS_TAG: Partial<Record<MindmapNodeStatus, string>> = {
  active: 'Writing…',
  error: 'Failed',
};

const fmtTime = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

const CLICKABLE_HINT: Partial<Record<MindmapNodeStatus, string>> = {
  done: 'Click to improve this draft (optionally with an instruction)',
  error: 'Click to try again',
  skipped: 'Click to generate now',
};

const NodeRow: React.FC<{
  node: MindmapNode;
  index: number;
  awaitingApproval?: boolean;
  onRetry: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onNodeClick: (nodeId: string, instruction?: string) => void;
  onSetInstruction?: (nodeId: string, text: string) => void;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ node, index, awaitingApproval, onRetry, onSkip, onFinish, onNodeClick, onSetInstruction, innerRef }) => {
  // During the review step every node is clickable to attach an instruction;
  // otherwise only settled nodes are clickable to regenerate/deepen.
  const instructionMode = !!awaitingApproval;
  const clickable = instructionMode || node.status === 'done' || node.status === 'skipped';
  const hint = instructionMode ? 'Tap to add an instruction for this section' : CLICKABLE_HINT[node.status];
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

  // In review every node is still "pending"; show it as a plain plan item.
  const look = instructionMode ? 'pending' : node.status;
  const tag = instructionMode ? undefined : STATUS_TAG[node.status];

  return (
    <div ref={innerRef} className={`nmp-item ${look}`}>
      <div className="nmp-badge" aria-hidden="true">
        {look === 'done' ? <Check className="w-4 h-4" strokeWidth={3} />
          : look === 'active' ? <Loader2 className="w-4 h-4 animate-spin" />
          : look === 'error' ? <AlertTriangle className="w-3.5 h-3.5" />
          : look === 'skipped' ? <Minus className="w-4 h-4" />
          : String(index + 1).padStart(2, '0')}
      </div>

      <div
        onClick={openPanel}
        role={openPanel ? 'button' : undefined}
        tabIndex={openPanel ? 0 : undefined}
        onKeyDown={openPanel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); } } : undefined}
        title={hint}
        className={`nmp-node${openPanel ? ' is-click' : ''}`}
      >
        <div className="nmp-node-top">
          <span className="nmp-label">{node.label}</span>
          {tag && <span className={`nmp-tag ${node.status}`}>{tag}</span>}
          {instructionMode
            ? <Wand2 className={`nmp-act w-4 h-4${node.instruction ? ' on' : ''}`} />
            : clickable && <Sparkles className="nmp-act w-3.5 h-3.5" />}
        </div>

        {node.children.length > 0 && (
          <div className="nmp-chips">
            {node.children.map((c) => <span key={c.id} className="nmp-chip">{c.label}</span>)}
          </div>
        )}

        {!instructionMode && node.status === 'active' && <div className="nmp-shimmer" aria-hidden="true" />}

        {/* Saved review-instruction badge (approval step, panel closed). */}
        {instructionMode && node.instruction && !panelOpen && (
          <div className="nmp-instr">
            <Wand2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{node.instruction}</span>
          </div>
        )}

        {/* Instruction / improve panel. During review it attaches a per-section
            instruction; after generation it refines the existing draft. */}
        {panelOpen && (
          <div className="nmp-panel" onClick={(e) => e.stopPropagation()}>
            <label>
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
            />
            <div className="nmp-row">
              <button type="button" onClick={submitPanel} className="nm-btn-primary flex-1">
                <Sparkles className="w-3.5 h-3.5" /> {instructionMode ? 'Save' : (node.status === 'skipped' ? 'Generate' : 'Regenerate')}
              </button>
              <button type="button" onClick={closePanel} className="nm-btn !px-3" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {node.status === 'error' && (
          <div className="nmp-row" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onRetry} className="nm-btn-primary flex-1">
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </button>
            <button type="button" onClick={onSkip} className="nm-btn flex-1">
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
            <button type="button" onClick={onFinish} title="Finish now with the notes already generated" className="nm-btn flex-1">
              <FastForward className="w-3.5 h-3.5" /> Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact heading + sub-headings list used by both sides of the before/after
// outline comparison.
const OutlineList: React.FC<{ sections: { heading: string; subheadings: string[] }[] }> = ({ sections }) => (
  <div className="nmp-ol">
    {sections.map((s, i) => (
      <div key={i}>
        <p>{i + 1}. {s.heading}</p>
        {s.subheadings.length > 0 && (
          <div className="nmp-chips">
            {s.subheadings.map((h, j) => <span key={j} className="nmp-chip">{h}</span>)}
          </div>
        )}
      </div>
    ))}
  </div>
);

export const MindmapOverlay: React.FC<MindmapOverlayProps> = ({
  mindmap, onRetry, onSkip, onFinish, onNodeClick, onSetNodeInstruction, onApprove, onRestructure, onCompareApply, onCompareDiscard, onAddMore, onDone, onMinimize,
}) => {
  const [addText, setAddText] = useState('');
  const awaiting = mindmap.awaitingApproval;
  const total = mindmap.nodes.length || 1;
  const settled = mindmap.nodes.filter((n) => n.status === 'done' || n.status === 'skipped').length;
  const pct = Math.round((settled / total) * 100);
  const subCount = mindmap.nodes.reduce((n, node) => n + node.children.length, 0);
  const instrCount = mindmap.nodes.filter((n) => n.instruction).length;

  // Keep the node currently being worked on (or the one paused on an error)
  // in view. On a Deep-level map with many sections the active node scrolls
  // below the fold, so the user loses sight of live progress without this.
  const activeNode = mindmap.nodes.find((n) => n.status === 'active');
  const errorNode = mindmap.errorNodeId ? mindmap.nodes.find((n) => n.id === mindmap.errorNodeId) : undefined;
  const activeNodeId = activeNode?.id ?? mindmap.errorNodeId;
  const activeNodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeNodeId && activeNodeRef.current) {
      activeNodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeNodeId]);

  // Elapsed time of the writing phase (starts once the plan is approved).
  const running = !awaiting && !mindmap.complete;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setStartedAt(prev => prev ?? Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const submitAdd = () => {
    const text = addText.trim();
    if (!text || mindmap.addBusy) return;
    onAddMore(text);
    setAddText('');
  };

  const canMinimize = !!onMinimize && running && !mindmap.errorNodeId;

  return (
    <div className="nmp-scrim">
      <section className="nmp-card nm-sheet nm-pop" aria-label="Notes plan">
        {/* header */}
        <header className="nmp-head">
          <div className="nmp-grab" aria-hidden="true" />
          <div className="nmp-titlerow">
            <div className="nmp-ico" aria-hidden="true">
              {mindmap.complete ? <PartyPopper className="w-5 h-5" /> : awaiting ? <ListTree className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="nmp-kicker">{awaiting ? 'Review the plan' : mindmap.complete ? 'Notes ready' : mindmap.subtitle}</p>
              <h3 className="nmp-title">{mindmap.title}</h3>
            </div>
            {canMinimize && (
              <button type="button" onClick={onMinimize} className="nmp-min" title="Hide the plan and watch the notes being written">
                <Eye className="w-4 h-4" /> <span>Watch notes</span>
              </button>
            )}
          </div>

          {awaiting ? (
            <>
              <div className="nmp-stats">
                <span className="nmp-stat"><b>{mindmap.nodes.length}</b> sections</span>
                {subCount > 0 && <span className="nmp-stat"><b>{subCount}</b> sub-topics</span>}
                {instrCount > 0 && <span className="nmp-stat is-ac"><Wand2 className="w-3 h-3" /><b>{instrCount}</b> instruction{instrCount > 1 ? 's' : ''}</span>}
                <span className="nmp-stat">{mindmap.subtitle}</span>
              </div>
              <p className="nmp-hint">
                {mindmap.compareOutline
                  ? 'Compare both outlines and pick the one to write.'
                  : <>Tap a section to give it an instruction, add missing points at the end, then press <strong>Approve &amp; Generate</strong>.</>}
              </p>
            </>
          ) : (
            <div className="nmp-prog">
              <div className="nmp-prog-top">
                <span className="nmp-pct">{pct}%</span>
                <span className="nmp-of">{settled} of {mindmap.nodes.length} sections</span>
                {startedAt !== null && !mindmap.complete && <span className="nmp-time" aria-label="Elapsed time">{fmtTime(now - startedAt)}</span>}
              </div>
              <div className="nmp-segs" aria-hidden="true">
                {mindmap.nodes.map((n) => <span key={n.id} className={`nmp-seg ${n.status}`} />)}
              </div>
              {!mindmap.complete && (errorNode || activeNode) && (
                <div className={`nmp-now${errorNode ? ' is-error' : ''}`}>
                  <span className="nmp-live" />
                  <span className="flex-shrink-0">{errorNode ? 'Stopped at' : 'Writing'}</span>
                  <b>{(errorNode || activeNode)!.label}</b>
                </div>
              )}
            </div>
          )}
        </header>

        {/* body */}
        <div className="nmp-body nm-scroll">
          {mindmap.compareOutline ? (
            <div className="nmp-compare">
              <div>
                <p className="nmp-col-title">Original</p>
                <OutlineList sections={mindmap.compareOutline.before} />
              </div>
              <div>
                <p className="nmp-col-title is-ac">Restructured</p>
                <OutlineList sections={mindmap.compareOutline.after} />
              </div>
            </div>
          ) : (
            <div className="nmp-list">
              {mindmap.nodes.length === 0 ? (
                <div className="nmp-foot-note !justify-start py-3">
                  <Loader2 className="w-4 h-4 animate-spin" /> Building the structure…
                </div>
              ) : (
                mindmap.nodes.map((node, i) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    index={i}
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

              {/* Add-a-point row, on the same spine as the sections. */}
              <div className="nmp-add">
                <div className="nmp-badge" aria-hidden="true"><Plus className="w-4 h-4" /></div>
                <div className="nmp-add-box">
                  <input
                    type="text"
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitAdd(); } }}
                    placeholder="Add another topic / heading…"
                    disabled={mindmap.addBusy}
                    aria-label="Add another topic"
                  />
                  <button
                    type="button"
                    onClick={submitAdd}
                    disabled={mindmap.addBusy || !addText.trim()}
                    className="nm-btn-primary !min-h-[38px] !px-3.5 text-xs flex-shrink-0"
                  >
                    {mindmap.addBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* footer — always on screen, so the next action never needs a scroll */}
        <footer className="nmp-foot">
          {mindmap.compareOutline ? (
            <div className="nmp-actions">
              <button type="button" onClick={onCompareDiscard} className="nm-btn">Keep original</button>
              <button type="button" onClick={onCompareApply} className="nm-btn-primary">
                <Shuffle className="w-4 h-4" /> Use restructured
              </button>
            </div>
          ) : awaiting ? (
            <div className="nmp-actions">
              {mindmap.canRestructure && (
                <button type="button" onClick={onRestructure} disabled={!!mindmap.restructuring} className="nm-btn" title="Better headings — every point is kept">
                  {mindmap.restructuring
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Restructuring…</>
                    : <><Shuffle className="w-4 h-4" /> Restructure</>}
                </button>
              )}
              <button type="button" onClick={onApprove} disabled={!!mindmap.restructuring} className="nm-btn-primary">
                <Sparkles className="w-4 h-4" /> Approve &amp; Generate
              </button>
            </div>
          ) : mindmap.complete ? (
            <div className="nmp-actions">
              <button type="button" onClick={onDone} className="nm-btn-primary">
                <PartyPopper className="w-4 h-4" /> Done — View notes
              </button>
            </div>
          ) : mindmap.errorNodeId ? (
            <p className="nmp-foot-note is-error"><AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>A section ran into a problem — Retry, Skip or Finish above.</span></p>
          ) : (
            <p className="nmp-foot-note">
              <span>Notes are being written into the page behind this.{canMinimize && <> Tap <strong className="text-[color:var(--nm-head)]">Watch notes</strong> to read along.</>}</span>
            </p>
          )}
        </footer>
      </section>
    </div>
  );
};
