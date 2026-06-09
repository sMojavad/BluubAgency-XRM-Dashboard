
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'resolution=merge-duplicates'
};

export const pushToSupabase = async (key: string, items: any[]): Promise<void> => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, value: items, updated_at: new Date().toISOString() })
    });
  } catch (e) {
    console.warn('Supabase push failed:', e);
  }
};

export const syncFromSupabase = async (): Promise<void> => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?select=key,value`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return;
    const rows: { key: string; value: any }[] = await res.json();
    for (const row of rows) {
      if (row.key && row.value !== undefined) {
        localStorage.setItem(row.key, JSON.stringify(row.value));
      }
    }
  } catch (e) {
    console.warn('Supabase sync failed:', e);
  }
};
