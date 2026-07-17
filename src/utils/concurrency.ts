// How many sections/outline-chunks/sub-batches a pipeline works on at once —
// each batch level runs at most 10 in flight. The GLOBAL wire ceiling is
// separate and higher (30, enforced at the fetch-interceptor chokepoint in
// services/ai/client.ts): when levels multiply (10 sections × their
// sub-batches), up to 30 AI calls may genuinely run at once; anything
// beyond that queues for a free slot.
export const PIPELINE_CONCURRENCY = 10;

// Run `count` async jobs with at most `limit` in flight at once, preserving
// nothing about completion order — callers that care about order write their
// result into a slot keyed by the index they receive. Used by the leveled
// pipelines to fan out per-chunk outline calls instead of awaiting them one
// by one (a multi-hour lecture has 10+ chunks; sequential outlining was the
// slowest part of Phase 1).
export async function mapWithConcurrency(
  count: number,
  limit: number,
  worker: (index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, count)) }, async () => {
    while (next < count) {
      const i = next++;
      await worker(i);
    }
  });
  await Promise.all(runners);
}
