import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!_client) {
    _client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'notesmaker_auth',
      },
    });
  }
  return _client;
}

// Single-user auto-login. The app is gated by a Supabase JWT (so the
// gemini-proxy edge function can verify it), but there's no signup UI —
// the user identity is baked in. Sign in once on app boot; cached session
// resumes silently on subsequent loads.
const SINGLE_USER_EMAIL = 'rahulznotes@gmail.com';
const SINGLE_USER_PASSWORD = '123456';

let _sessionReadyPromise: Promise<Session | null> | null = null;

export function ensureSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (_sessionReadyPromise) return _sessionReadyPromise;
  _sessionReadyPromise = (async () => {
    const sb = getSupabaseClient();
    const { data: { session } } = await sb.auth.getSession();
    if (session) return session;
    const { data, error } = await sb.auth.signInWithPassword({
      email: SINGLE_USER_EMAIL,
      password: SINGLE_USER_PASSWORD,
    });
    if (error) throw new Error(`Auto sign-in failed: ${error.message}`);
    return data.session;
  })();
  return _sessionReadyPromise;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await ensureSession();
  return session?.access_token ?? null;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithContent extends Project {
  content: string | null;
}
