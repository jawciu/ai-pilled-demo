import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GuestRoomError, guestRoomPeople, validRoomSlug } from '@/lib/guest-room';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!validRoomSlug(slug)) return NextResponse.json({ error: 'A valid event link is required.' }, { status: 400, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ error: 'The room is temporarily unavailable.' }, { status: 503, headers });
  try {
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    return NextResponse.json({ people: await guestRoomPeople(db, slug) }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GuestRoomError ? error.message : 'Could not load the room. Please try again.' }, { status: error instanceof GuestRoomError ? error.status : 503, headers });
  }
}
