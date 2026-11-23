'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, interpretProfile } from './supabase';
import { demoPeople, demoProfile } from './demo';
import { profileSchema, messageSchema } from './validation';
import type { Conversation, Match, Message, Person, ProfileInput } from './types';

export type InboxItem = { conversation_id: string; preview: string | null; last_message_at: string; unread: number };
type DemoState = { me: Person | null; conversations: Conversation[]; messages: Message[]; read: Record<string, string> };
const DEMO_KEY = 'ai-pilled-rehearsal-v1';
const blank: DemoState = { me: null, conversations: [], messages: [], read: {} };
function loadDemo(): DemoState {
  try { const raw = localStorage.getItem(DEMO_KEY); return raw ? JSON.parse(raw) : blank; } catch { return blank; }
}
function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const text = String(error.message);
    if (text.includes('schema cache') || text.includes('does not exist')) return 'The event database is not set up yet. Ask the organiser to apply supabase/setup.sql, or try the rehearsal.';
    return text;
  }
  return 'Something went wrong. Please try again.';
}
export function useMeetup(slug: string, demo: boolean) {
  const [me, setMe] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [matches, setMatches] = useState<{ receive: Match[]; give: Match[] }>({ receive: [], give: [] });
  const reviewInFlight = useRef(false);
  const reviewRetryAt = useRef(0);
  const [reviewPending, setReviewPending] = useState(0);
  const [reviewError, setReviewError] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [recommendationError, setRecommendationError] = useState('');
  const [connected, setConnected] = useState(false);
  const demoRef = useRef<DemoState>(blank);
  const mounted = useRef(true);
  const refreshing = useRef(false);
  const activeRef = useRef(active); activeRef.current = active;

  const syncDemo = useCallback((state: DemoState) => {
    demoRef.current = state;
    localStorage.setItem(DEMO_KEY, JSON.stringify(state));
    setMe(state.me);
    setPeople([...demoPeople().filter(p => p.name !== 'Maya'), ...(state.me ? [state.me] : [])]);
    setConversations(state.conversations);
    setMessages(state.messages.filter(m => m.conversation_id === activeRef.current));
    setInbox(state.conversations.map(c => {
      const msgs = state.messages.filter(m => m.conversation_id === c.id);
      return { conversation_id: c.id, preview: msgs.at(-1)?.body ?? null, last_message_at: msgs.at(-1)?.created_at ?? c.created_at,
        unread: msgs.filter(m => m.sender_id !== state.me?.id && m.created_at > (state.read[c.id] || '')).length };
    }));
  }, []);

  const runReview = useCallback(async (token: string) => {
    if (reviewInFlight.current || Date.now() < reviewRetryAt.current) return;
    reviewInFlight.current = true;
    try {
      const response = await fetch('/api/review', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Some connection checks could not finish. We’ll retry shortly.');
      setReviewError('');
    } catch (e) { setReviewError(errorText(e)); reviewRetryAt.current = Date.now()+60000; }
    finally { reviewInFlight.current = false; }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current || demo) return;
    refreshing.current = true;
    try {
      const db = supabase();
      const { data: session } = await db.auth.getSession();
      if (!session.session) { setMe(null); setLoading(false); return; }
      const [profiles, chats, previews, event] = await Promise.all([
        db.from('participants').select('id,event_id,name,need,offer,recognition,answer_version,updated_at,analysis_version:interpretation->version,analysis_pipeline:interpretation->pipeline').order('name').limit(200),
        db.from('conversations').select('*'), db.rpc('get_inbox'), db.from('events').select('slug')
      ]);
      if (profiles.error) throw profiles.error;
      if (chats.error) throw chats.error;
      if (previews.error) throw previews.error;
      if (event.error) throw event.error;
      if (event.data.length && event.data[0].slug !== slug) throw new Error('This browser has joined a different event. Use your original event link or a separate browser session.');
      if (!mounted.current) return;
      const mapped = profiles.data.map(p => ({ ...p, interpretation: p.analysis_version ? { version: p.analysis_version, pipeline: p.analysis_pipeline, needs: [], offers: [], model: '' } : null })) as Person[];
      setPeople(mapped);
      setMe(mapped.find(p => p.id === session.session!.user.id) || null);
      try {
        const response = await fetch('/api/recommendations', { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load recommendations. Please try again.');
        setMatches({ receive: result.receive, give: result.give }); setRecommendationError('');
        setReviewPending(result.pending || 0);
        if (result.pending > 0) void runReview(session.session.access_token);
        else setReviewError('');
      } catch (e) {
        setMatches({ receive: [], give: [] });
        setRecommendationError(errorText(e));
      }
      setConversations(chats.data);
      setInbox(previews.data || []);
      const requestedConversation = activeRef.current;
      if (requestedConversation) {
        const result = await db.from('messages').select('*').eq('conversation_id', requestedConversation).order('created_at', { ascending: false }).limit(100);
        if (result.error) throw result.error;
        if (requestedConversation === activeRef.current) setMessages((result.data || []).reverse());
      }
      setConnected(true);
    } catch (e) { setError(errorText(e)); setConnected(false); }
    finally { refreshing.current = false; setLoading(false); }
  }, [demo, slug, runReview]);

  useEffect(() => {
    mounted.current = true;
    if (demo) { syncDemo(loadDemo()); setLoading(false); return; }
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [demo, refresh, syncDemo]);

  useEffect(() => {
    if (demo || !me) return;
    const db = supabase();
    const channel = db.channel(`event-${me.event_id}-${me.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${me.event_id}` }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void refresh())
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [demo, me?.id, me?.event_id, refresh]);

  useEffect(() => {
    if (demo) { syncDemo(demoRef.current); return; }
    setMessages([]);
    if (active) void refresh();
  }, [active, demo, refresh, syncDemo]);

  const analyse = useCallback(async () => {
    if (demo) return;
    setAnalysing(true); setAnalysisError('');
    try { await interpretProfile(); await refresh(); }
    catch (e) { setAnalysisError(errorText(e)); }
    finally { setAnalysing(false); }
  }, [demo, refresh]);

  async function save(input: ProfileInput) {
    setError(''); setBusy(true);
    try {
      const parsed = profileSchema.safeParse(input);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (demo) { syncDemo({ ...demoRef.current, me: demoProfile(parsed.data, demoRef.current.me || undefined) }); return true; }
      const db = supabase();
      const { data: session } = await db.auth.getSession();
      if (!session.session) {
        const { error } = await db.auth.signInAnonymously();
        if (error) throw error;
      }
      if (me) {
        const { error } = await db.from('participants').update(parsed.data).eq('id', me.id);
        if (error) throw error;
      } else {
        const { error } = await db.rpc('join_event', { p_slug: slug, p_name: parsed.data.name, p_need: parsed.data.need, p_offer: parsed.data.offer, p_recognition: parsed.data.recognition });
        if (error) throw error;
      }
      await refresh();
      return true;
    } catch (e) { setError(errorText(e)); return false; }
    finally { setBusy(false); }
  }

  async function start(other: Person) {
    setError('');
    try {
      if (!me) throw new Error('Join the event first.');
      let id: string;
      if (demo) {
        const old = demoRef.current.conversations.find(c => c.participant_a === other.id || c.participant_b === other.id);
        id = old?.id || crypto.randomUUID();
        if (!old) syncDemo({ ...demoRef.current, conversations: [...demoRef.current.conversations, { id, event_id: 'demo', participant_a: me.id, participant_b: other.id, created_at: new Date().toISOString() }] });
      } else {
        const { data, error } = await supabase().rpc('start_conversation', { p_other: other.id });
        if (error) throw error;
        id = data; await refresh();
      }
      setActive(id); return id;
    } catch (e) { setError(errorText(e)); return null; }
  }

  async function send(body: string, clientId: string, conversationId: string) {
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (!me) throw new Error('Join first.');
    if (demo) {
      if (!demoRef.current.messages.some(m => m.client_id === clientId)) syncDemo({ ...demoRef.current, messages: [...demoRef.current.messages, { id: crypto.randomUUID(), client_id: clientId, conversation_id: conversationId, sender_id: me.id, body: parsed.data, created_at: new Date().toISOString() }] });
    } else {
      const { error } = await supabase().rpc('send_message', { p_conversation: conversationId, p_body: parsed.data, p_client_id: clientId });
      if (error) throw new Error(errorText(error));
      await refresh();
    }
  }
  async function markRead(id: string) {
    if (demo) { syncDemo({ ...demoRef.current, read: { ...demoRef.current.read, [id]: new Date().toISOString() } }); return; }
    const { error } = await supabase().rpc('mark_read', { p_conversation: id });
    if (!error) setInbox(items => items.map(i => i.conversation_id === id ? { ...i, unread: 0 } : i));
  }
  function simulateReply() {
    const convo = demoRef.current.conversations.find(c => c.id === active);
    if (!convo || !me) return;
    const other = convo.participant_a === me.id ? convo.participant_b : convo.participant_a;
    syncDemo({ ...demoRef.current, messages: [...demoRef.current.messages, { id: crypto.randomUUID(), client_id: crypto.randomUUID(), conversation_id: convo.id,
      sender_id: other, body: 'This is a simulated rehearsal reply: happy to chat — I’m near the coffee table!', created_at: new Date().toISOString() }] });
  }
  return { me, people, matches, conversations, inbox, messages, active, setActive, loading, busy, analysing, error, setError, analysisError, recommendationError, reviewPending, reviewError, connected, save, start, send, markRead, analyse, refresh, simulateReply };
}
