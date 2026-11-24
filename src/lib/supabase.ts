import { AnalysisRequestError } from './analysis-retry';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let browserClient: SupabaseClient | undefined;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Live participation is not configured yet. Try the rehearsal instead.');
  browserClient ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return browserClient;
}
export async function interpretProfile(signal?: AbortSignal) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw new Error('Your session has expired. Please reopen the event link.');
  const response = await fetch('/api/interpret', { method: 'POST', signal, headers: { Authorization: `Bearer ${data.session.access_token}` } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new AnalysisRequestError(result.error || 'Recommendations could not be prepared. Please try again.', response.status, response.headers.get('Retry-After'));
  return result;
}
