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

// The login form accepts any email/password — Supabase signs the user
// in if the credentials match an existing user. There's no signup UI;
// user creation is admin-only. Credentials are NOT pre-filled or baked
// into the bundle; the user types them each time.

/** Restore a cached session if one is present. Used by the boot path so
 *  the app skips the login form when the user is already signed in. */
export async function getCachedSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabaseClient();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

/** Sign in with explicit credentials (called from the login form). */
export async function signInWithCredentials(email: string, password: string): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured.');
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('No session returned.');
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabaseClient();
  const { data: { session } } = await sb.auth.getSession();
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
