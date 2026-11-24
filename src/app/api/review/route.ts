import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { reviewFailureCode } from '@/lib/ai-matching';
import { partitionReviewJobs, prepareReviewBatch } from '@/lib/review-batch';
import type { MatchReview, Person } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get('authorization');
  if (!url || !key || !authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const db = createClient(url,key,{ global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!secret || !process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Connection checks are not configured. Your profile and inbox still work.' }, { status: 503 });
  const admin = createClient(url,secret,{ auth: { persistSession: false } });
  const { data: claimed, error: claimError } = await db.rpc('claim_match_reviews_v3',{ p_limit: 8 });
  if (claimError) return NextResponse.json({ error: 'Connection checks need the matching database update. Your inbox still works.' }, { status: 503 });
  const jobs = claimed as MatchReview[];
  if (!jobs.length) return NextResponse.json({ reviewed: 0 });
  try {
    const ids = [...new Set(jobs.flatMap(j => [j.requester_id,j.helper_id]))];
    const { data, error } = await db.from('participants').select('*').in('id',ids);
    if (error) throw new Error('Could not read matching profiles');
    const people = new Map((data as Person[]).map(p => [p.id,p]));
    // An edit between claiming and reading must not occupy an event worker for
    // the remaining 90 seconds. Release only this exact obsolete lease/version.
    const {valid,obsolete} = partitionReviewJobs(jobs,people);
    for (const job of obsolete) {
      const {error:releaseError} = await admin.from('match_reviews').update({
        status:'failed',decision:null,lease_until:new Date(0).toISOString(),updated_at:new Date().toISOString()
      }).eq('requester_id',job.requester_id).eq('helper_id',job.helper_id)
        .eq('requester_version',job.requester_version).eq('helper_version',job.helper_version)
        .eq('revision',job.revision).eq('lease_id',job.lease_id).eq('status','processing');
      if (releaseError) throw new Error('Could not release obsolete connection check');
    }
    const prepared = await prepareReviewBatch(valid,people);
    for (const { job, decision } of prepared) {
      const { error: saveError } = await admin.from('match_reviews').update({ status: 'ready', decision: { ...decision, scope_policy: 3 }, updated_at: new Date().toISOString() })
        .eq('requester_id',job.requester_id).eq('helper_id',job.helper_id)
        .eq('requester_version',job.requester_version).eq('helper_version',job.helper_version)
        .eq('revision',job.revision).eq('lease_id',job.lease_id).eq('status','processing');
      if (saveError) throw new Error('Could not cache connection check');
    }
    return NextResponse.json({ reviewed: prepared.length });
  } catch (error) {
    const code = reviewFailureCode(error);
    console.error('Connection review failed',{ code });
    for (const job of jobs) await admin.from('match_reviews').update({ status: 'failed', decision: null, lease_until: new Date(Date.now()+60000).toISOString(), updated_at: new Date().toISOString() })
      .eq('requester_id',job.requester_id).eq('helper_id',job.helper_id)
      .eq('requester_version',job.requester_version).eq('helper_version',job.helper_version)
      .eq('revision',job.revision).eq('lease_id',job.lease_id).eq('status','processing');
    return NextResponse.json({ code, error: 'We couldn’t check some connections. We’ll retry shortly; no guessed introductions have been added.' }, { status: 502, headers: { 'Retry-After': '60' } });
  }
}
