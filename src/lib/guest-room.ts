import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from './types';
import { withRequestTimeout } from './request-timeout';

export class GuestRoomError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export function validRoomSlug(slug: string | null): slug is string {
  return !!slug && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(slug);
}
// This service is called only by the server route. The event link grants read
// access to profile cards, never to conversations, model output or auth data.
export async function guestRoomPeople(db: SupabaseClient, slug: string): Promise<Person[]> {
  if (!validRoomSlug(slug)) throw new GuestRoomError('A valid event link is required.', 400);
  const event = await withRequestTimeout(signal => db.from('events').select('id').eq('slug', slug).abortSignal(signal).maybeSingle());
  if (event.error) throw new GuestRoomError('Could not load the room. Please try again.', 503);
  if (!event.data) throw new GuestRoomError('This event could not be found.', 404);
  const eventId = event.data.id;
  const people = await withRequestTimeout(signal => db.from('participants')
    .select('id,event_id,name,need,offer,recognition,answer_version,updated_at')
    .eq('event_id', eventId).order('updated_at', { ascending: false }).limit(200).abortSignal(signal));
  if (people.error) throw new GuestRoomError('Could not load the room. Please try again.', 503);
  return (people.data || []).filter(p => p.event_id === eventId).map(p => ({
    id: p.id, event_id: p.event_id, name: p.name, need: p.need, offer: p.offer,
    recognition: p.recognition, answer_version: p.answer_version, updated_at: p.updated_at,
    interpretation: null,
  }));
}
