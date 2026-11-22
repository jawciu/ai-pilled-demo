import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { recommendations } from '@/lib/matching';
import type { Person } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const db = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: people, error: readError } = await db.from('participants').select('*').limit(200);
  if (readError) return NextResponse.json({ error: 'Could not load recommendations.' }, { status: 503 });
  const me = (people as Person[]).find(p => p.id === user.id);
  if (!me) return NextResponse.json({ receive: [], give: [] });
  const trim = (direction: 'receive' | 'give') => recommendations(me, people as Person[], direction).map(match => ({ ...match, score: undefined, person: { ...match.person, interpretation: null } }));
  return NextResponse.json({ receive: trim('receive'), give: trim('give') }, { headers: { 'Cache-Control': 'private, no-store' } });
}
