import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { extractionSchema } from '@/lib/validation';
import type { Person } from '@/lib/types';
import { extractionInstructions, openaiJSON, PIPELINE_REVISION } from '@/lib/ai-matching';

export const runtime = 'nodejs';
export const maxDuration = 60;
const topicJSON = { type: 'object', additionalProperties: false, required: ['topic', 'summary', 'evidence', 'specific'], properties: {
  topic: { type: 'string' }, summary: { type: 'string' }, evidence: { type: 'string' }, specific: { type: 'boolean' }
} };
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret || !process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI recommendations are not configured yet. Your profile and messages still work.' }, { status: 503 });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const userDB = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await userDB.auth.getUser(authorization.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Your session has expired.' }, { status: 401 });
  const { data, error } = await userDB.from('participants').select('*').eq('id', user.id).single();
  if (error || !data) return NextResponse.json({ error: 'Join the event first.' }, { status: 403 });
  const person = data as Person;
  if (person.interpretation?.version === person.answer_version && person.interpretation.pipeline === PIPELINE_REVISION) return NextResponse.json({ cached: true });
  const { data: claimed, error: claimError } = await userDB.rpc('claim_analysis');
  if (claimError || !claimed) return NextResponse.json({ error: 'Recommendations are being prepared, or were recently attempted. Please try again in a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const result = await openaiJSON('chat/completions', {
      model, temperature: 0, max_completion_tokens: 1800,
      messages: [
        { role: 'system', content: extractionInstructions },
        { role: 'user', content: JSON.stringify({ need: person.need, offer: person.offer }) }
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'participant_topics', strict: true, schema: {
        type: 'object', additionalProperties: false, required: ['needs', 'offers'], properties: {
          needs: { type: 'array', items: topicJSON }, offers: { type: 'array', items: topicJSON }
        }
      } } }
    });
    const extraction = extractionSchema.parse(JSON.parse(result.choices?.[0]?.message?.content || ''));
    for (const item of extraction.needs) if (!person.need.includes(item.evidence)) throw new Error('Unsupported need evidence');
    for (const item of extraction.offers) if (!person.offer.includes(item.evidence)) throw new Error('Unsupported offer evidence');
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    const { data: saved, error: saveError } = await admin.from('participants').update({ interpretation: { ...extraction, version: person.answer_version, model, pipeline: PIPELINE_REVISION } })
      .eq('id', user.id).eq('answer_version', person.answer_version).select('id');
    if (saveError) throw new Error('Cache write failed');
    if (!saved?.length) return NextResponse.json({ error: 'Your answers changed during processing. Please try again.' }, { status: 409 });
    return NextResponse.json({ cached: false });
  } catch (error) {
    console.error('Profile interpretation failed', { type: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ error: 'We couldn’t prepare your recommendations. Your answers are saved. Please try again in a minute.' }, { status: 502 });
  }
}
