// Shared "improve this draft" directive used by every expand-a-section
// function across the leveled pipelines. When the user clicks a mind-map
// node that already has content, the regenerate call can carry the existing
// HTML (so the model refines/extends what's there instead of starting over)
// and/or a free-text instruction typed by the user (e.g. "add a real
// example", "make a comparison table here", "explain this like I'm a
// beginner"). Both are optional — the default node click (no instruction)
// still just asks for a deeper rewrite from the source.

export interface RefinementOptions {
  existingHtml?: string;
  customInstruction?: string;
}

export function buildRefinementDirective(opts?: RefinementOptions): string {
  if (!opts || (!opts.existingHtml && !opts.customInstruction)) return '';

  const blocks: string[] = [];
  if (opts.existingHtml) {
    blocks.push(`
    ═══ EXISTING DRAFT FOR THIS SECTION (already generated once) ═══
    This is a REVISION pass, not a first draft. Improve, deepen or extend this existing content — keep what's already good, fix or expand what's weak. Do not just repeat it unchanged, and do not discard accurate content for no reason.
    """${opts.existingHtml}"""`);
  }
  if (opts.customInstruction) {
    blocks.push(`
    ═══ USER'S SPECIFIC INSTRUCTION FOR THIS REVISION — follow it precisely, above any general guidance ═══
    "${opts.customInstruction}"`);
  }
  return blocks.join('\n');
}
