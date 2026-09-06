import type { UPSCSubject } from './upscAnswerGeneration';

// Shared by the browser app (useGeneration.ts) and the background worker
// (worker/) so a queued UPSC answer renders as the exact same block no
// matter which one generated it.

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain question — no subject-tag pill, no background box. Just a bold
// "Q. ..." line so the question reads like a normal exam-copy heading
// instead of a styled card (see .upsc-question in index.css). `_subject`
// is unused today but kept in the signature so existing call sites don't
// need to change shape.
export const wrapUPSCBlock = (question: string, answerHtml: string, _subject: UPSCSubject, extraAttr = ''): string => {
  return `<section class="upsc-qa-block"${extraAttr}><div class="upsc-question-header"><h2 class="upsc-question">Q. ${escapeHtml(question)}</h2></div>${answerHtml}</section>`;
};
