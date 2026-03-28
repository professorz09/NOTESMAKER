import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (!_client) {
    _client = createClient(supabaseUrl!, supabaseAnonKey!);
  }
  return _client;
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
