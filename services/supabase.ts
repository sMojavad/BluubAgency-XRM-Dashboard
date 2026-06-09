
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://xfzgpvycaifmcbgrnknb.supabase.co';
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmemdwdnljYWlmbWNiZ3Jua25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjcxMTUsImV4cCI6MjA5NTE0MzExNX0.sDo1jIyP6EelDoEcB1tPdG8Xb-3L1xGNLa86pgLy2Zg';

const SYNC_TS_PREFIX = '_xrm_synced_at_';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'resolution=merge-duplicates'
};

export const pushToSupabase = async (key: string, items: any[]): Promise<void> => {
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, value: items, updated_at: now })
    });
    if (res.ok) {
      // Mark local data as successfully synced with this timestamp
      localStorage.setItem(`${SYNC_TS_PREFIX}${key}`, now);
    }
  } catch (e) {
    console.warn('Supabase push failed:', e);
  }
};

export const syncFromSupabase = async (): Promise<void> => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?select=key,value,updated_at`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return;

    const rows: { key: string; value: any; updated_at: string }[] = await res.json();

    for (const row of rows) {
      if (!row.key || row.value === undefined) continue;

      const localSyncedAt = localStorage.getItem(`${SYNC_TS_PREFIX}${row.key}`);

      // Only overwrite local data if:
      // 1. No local data exists at all (fresh device), OR
      // 2. Supabase data is strictly newer than the last successful local push
      const localExists = localStorage.getItem(row.key) !== null;
      const supabaseIsNewer = !localSyncedAt || new Date(row.updated_at) > new Date(localSyncedAt);

      if (!localExists || supabaseIsNewer) {
        localStorage.setItem(row.key, JSON.stringify(row.value));
        localStorage.setItem(`${SYNC_TS_PREFIX}${row.key}`, row.updated_at);
      }
    }
  } catch (e) {
    console.warn('Supabase sync failed:', e);
  }
};
