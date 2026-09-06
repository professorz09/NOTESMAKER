import React from 'react';

// Shown on the canvas while a saved note is being fetched. A long note (the
// batch queue can grow one into hundreds of KB) takes a visible moment to
// come back, and before this the page just sat there showing the PREVIOUS
// note's content — so it read as "the click didn't work", or worse, as if
// the wrong note had opened.
//
// Deliberately shaped like the notes themselves — a title, a couple of
// paragraphs, a heading, more paragraphs — so the wait looks like the page
// filling in rather than a generic spinner.
const BAR = 'rounded bg-slate-200/80 dark:bg-slate-700/60';

export const NoteSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6 py-2" aria-label="Loading note" role="status">
    <div className="space-y-3">
      <div className={`h-7 w-3/5 ${BAR}`} />
      <div className={`h-3.5 w-1/4 ${BAR}`} />
    </div>

    {[0, 1].map(block => (
      <div key={block} className="space-y-2.5">
        <div className={`h-4 w-full ${BAR}`} />
        <div className={`h-4 w-11/12 ${BAR}`} />
        <div className={`h-4 w-full ${BAR}`} />
        <div className={`h-4 w-4/6 ${BAR}`} />
      </div>
    ))}

    <div className={`h-5 w-2/5 ${BAR}`} />

    <div className="space-y-2.5">
      <div className={`h-4 w-full ${BAR}`} />
      <div className={`h-4 w-10/12 ${BAR}`} />
      <div className={`h-4 w-full ${BAR}`} />
      <div className={`h-4 w-3/6 ${BAR}`} />
    </div>
  </div>
);
