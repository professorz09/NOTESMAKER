// How many sections/outline-chunks/sub-batches a pipeline works on at once.
// The proxy imposes no rate limit of its own; the real ceiling is Vertex
// AI's per-minute quota, and a GLOBAL cap of 10 simultaneous AI requests is
// enforced at the fetch-interceptor chokepoint in services/ai/client.ts —
// so even when this per-level parallelism multiplies (10 sections × sub-
// batches), the wire never carries more than 10 calls at once; extras queue.
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
