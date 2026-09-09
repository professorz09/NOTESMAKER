// Detects that this tab is running an OUTDATED build of the app.
//
// Every protection against clobbering a note — the revision-checked save,
// the refresh-on-focus, the one-writer-per-note claim — lives in the client
// bundle. A tab loaded before those shipped keeps running the old code and
// keeps overwriting notes, and there is nothing the server or the worker can
// do about it. That is not hypothetical: a tab left open across a deploy
// wiped two freshly generated answers out of a note this way, because its
// three-second autosave was still the old unguarded write.
//
// So an outdated tab has to stop writing. Detecting it needs no build
// plumbing: Vite fingerprints the entry bundle (index-<hash>.js), so the
// filename in a freshly fetched index.html differs from the one this tab
// loaded exactly when a new version has been deployed.

const ENTRY_RE = /src="[^"]*\/(index-[A-Za-z0-9_.-]+\.js)"/;

function loadedEntryName(): string | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  for (const s of scripts) {
    const name = s.src.split('/').pop();
    if (name && /^index-.+\.js$/.test(name)) return name;
  }
  return null;
}

/**
 * True when the deployed build no longer matches the one running here.
 * Deliberately conservative: any uncertainty (dev server, fetch failure,
 * unrecognisable HTML) returns false, because falsely declaring a tab stale
 * would block saving for no reason.
 */
export async function isOutdatedBuild(): Promise<boolean> {
  const mine = loadedEntryName();
  if (!mine) return false;
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const deployed = (await res.text()).match(ENTRY_RE)?.[1];
    return !!deployed && deployed !== mine;
  } catch {
    return false;
  }
}
