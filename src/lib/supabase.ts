import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serverSyncedUrl = '';
let serverSyncedKey = '';
let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

type ConfigListener = (isConfigured: boolean) => void;
const configListeners = new Set<ConfigListener>();

export function onSupabaseConfigChange(listener: ConfigListener) {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

function notifyConfigListeners() {
  const configured = isSupabaseConfigured();
  configListeners.forEach((fn) => {
    try {
      fn(configured);
    } catch (e) {
      console.error(e);
    }
  });
}

// Get Supabase credentials from server sync, Vite environment, or localStorage
export function getSupabaseCredentials(): { url: string; key: string } {
  const env = (import.meta as any).env || {};
  const envUrl = (env.VITE_SUPABASE_URL as string) || '';
  const envKey = (env.VITE_SUPABASE_ANON_KEY as string) || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_project_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '';

  const finalUrl = serverSyncedUrl.trim() || localUrl.trim() || envUrl.trim();
  const finalKey = serverSyncedKey.trim() || localKey.trim() || envKey.trim();

  return {
    url: finalUrl,
    key: finalKey,
  };
}

/**
 * Sync Supabase credentials from server so new devices and browsers don't need to re-login
 */
export async function syncSupabaseConfigFromServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/supabase-config');
    if (!res.ok) return false;
    const data = await res.json();

    if (data && data.configured && data.url && data.key) {
      serverSyncedUrl = String(data.url).trim();
      serverSyncedKey = String(data.key).trim();

      if (typeof window !== 'undefined') {
        localStorage.setItem('supabase_project_url', serverSyncedUrl);
        localStorage.setItem('supabase_anon_key', serverSyncedKey);
      }

      // Recreate client if needed
      getSupabaseClient();
      notifyConfigListeners();
      return true;
    }
  } catch (err) {
    console.warn('Gagal sinkronisasi kredensial Supabase dari server:', err);
  }
  return false;
}

/**
 * Save credentials locally and permanently to server so ALL devices stay connected
 */
export function saveSupabaseCredentials(url: string, key: string): void {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  serverSyncedUrl = cleanUrl;
  serverSyncedKey = cleanKey;

  if (typeof window !== 'undefined') {
    if (cleanUrl) localStorage.setItem('supabase_project_url', cleanUrl);
    else localStorage.removeItem('supabase_project_url');

    if (cleanKey) localStorage.setItem('supabase_anon_key', cleanKey);
    else localStorage.removeItem('supabase_anon_key');
  }

  // Reset supabase client instance
  supabaseInstance = null;
  lastUrl = '';
  lastKey = '';

  // Permanently save to server backend in the background so other devices and browsers share it
  if (cleanUrl && cleanKey) {
    fetch('/api/supabase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, key: cleanKey }),
    }).catch((err) => console.warn('Gagal menyimpan kredensial ke server:', err));
  }

  notifyConfigListeners();
}

/**
 * Clear credentials locally and on server
 */
export function clearSupabaseCredentials(): void {
  serverSyncedUrl = '';
  serverSyncedKey = '';
  supabaseInstance = null;
  lastUrl = '';
  lastKey = '';

  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase_project_url');
    localStorage.removeItem('supabase_anon_key');
  }

  fetch('/api/supabase-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset: true }),
  }).catch(() => {});

  notifyConfigListeners();
}

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

