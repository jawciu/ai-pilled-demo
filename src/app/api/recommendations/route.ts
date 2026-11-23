import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { reviewedRecommendations } from '@/lib/reviewed-matching';
import type { MatchReview, Person } from '@/lib/types';
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
  const { data: reviews, error: reviewError } = await db.rpc('current_match_reviews');
  if (reviewError) return NextResponse.json({ error: 'Connection checks need the matching database update. Your profile and inbox still work.' }, { status: 503 });
  const result = reviewedRecommendations(me,people as Person[],reviews as MatchReview[]);
  const trim = (matches: typeof result.receive) => matches.map(({ score: _score,...match }) => match);
  return NextResponse.json({ ...result, receive: trim(result.receive), give: trim(result.give) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
