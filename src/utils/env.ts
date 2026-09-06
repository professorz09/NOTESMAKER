// Reads a config value from whichever runtime this module happens to be
// loaded under. The Vite frontend bundle exposes VITE_-prefixed vars via
// `import.meta.env`; the background worker (see worker/) runs the same
// services/* modules (services/supabase.ts, services/ai/client.ts) under
// plain Node, where `import.meta.env` doesn't exist and only `process.env`
// is available. Node's own `import.meta` object still exists (it just has
// no `.env`), so the optional chain below never throws — it simply falls
// through to `undefined` when running there.
export function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return (import.meta as any)?.env?.[key];
}
