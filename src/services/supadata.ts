import { getAccessToken } from './supabase';

// Client for the supadata-proxy edge function: paste a video link (YouTube,
// etc.), get its transcript text back. Long videos (>~20 min — i.e. every
// class recording) are processed asynchronously by Supadata, so we poll a job
// until it completes.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPADATA_PROXY_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/supadata-proxy` : '';

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i;

/** Loose check that a string looks like a supported video link. */
export function looksLikeVideoUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (YOUTUBE_RE.test(t)) return true;
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|x\.com|twitter\.com|facebook\.com)\//i.test(t);
}

async function callProxy(body: Record<string, unknown>): Promise<any> {
  if (!SUPADATA_PROXY_URL) throw new Error('Supadata proxy not configured — VITE_SUPABASE_URL missing.');
  const token = await getAccessToken();
  if (!token) throw new Error('Sign-in required to fetch transcripts.');
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const res = await fetch(SUPADATA_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(anon ? { apikey: anon } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Transcript fetch failed (${res.status}).`);
  }
  return data;
}

export interface FetchTranscriptOptions {
  lang?: string;
  onStatus?: (status: string) => void;
  signal?: { aborted: boolean };
}

/**
 * Fetch the transcript text for a video URL. Resolves the async Supadata job
 * by polling until it completes (up to ~5 minutes). Throws on failure.
 */
export async function fetchVideoTranscript(url: string, opts: FetchTranscriptOptions = {}): Promise<string> {
  const { lang, onStatus, signal } = opts;
  onStatus?.('Transcript माँगी जा रही है…');
  const started = await callProxy({ action: 'start', url: url.trim(), lang });

  if (started.status === 'completed' && started.content) {
    return String(started.content);
  }

  const jobId = started.jobId;
  if (!jobId) {
    if (started.content) return String(started.content);
    throw new Error('Supadata से transcript नहीं मिली (कोई job नहीं)।');
  }

  // Poll the job. Native-caption jobs usually finish in seconds even for long
  // videos, but allow generous time for very long recordings.
  const MAX_POLLS = 100;
  const INTERVAL_MS = 3000;
  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal?.aborted) throw new Error('रद्द कर दिया गया।');
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    onStatus?.(`Transcript तैयार हो रही है… (${i + 1})`);
    const polled = await callProxy({ action: 'poll', jobId });
    if (polled.status === 'completed') {
      if (!polled.content) throw new Error('Transcript खाली मिली।');
      return String(polled.content);
    }
    if (polled.status === 'failed') {
      throw new Error(polled.error || 'Supadata transcript job विफल रहा।');
    }
    // queued / active → keep polling
  }
  throw new Error('Transcript बहुत देर तक तैयार नहीं हुई — बाद में पुनः प्रयास करें।');
}
