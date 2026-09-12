import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase credentials from Vite environment or localStorage for in-browser setup
export function getSupabaseCredentials(): { url: string; key: string } {
  const env = (import.meta as any).env || {};
  const envUrl = (env.VITE_SUPABASE_URL as string) || '';
  const envKey = (env.VITE_SUPABASE_ANON_KEY as string) || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_project_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '';

  return {
    url: localUrl.trim() || envUrl.trim(),
    key: localKey.trim() || envKey.trim(),
  };
}

export function saveSupabaseCredentials(url: string, key: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('supabase_project_url', url.trim());
    else localStorage.removeItem('supabase_project_url');

    if (key) localStorage.setItem('supabase_anon_key', key.trim());
    else localStorage.removeItem('supabase_anon_key');
  }
}

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance || lastUrl !== url || lastKey !== key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      lastUrl = url;
      lastKey = key;
    } catch (err) {
      console.error('Error creating Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
};
