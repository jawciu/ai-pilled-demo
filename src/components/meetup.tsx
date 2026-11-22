'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Coffee, HeartHandshake, LoaderCircle, MessageCircle, Send, Sparkles, UserRound, Users, X } from 'lucide-react';
import { useMeetup } from '@/lib/use-meetup';
import { recommendations } from '@/lib/matching';
import { demoPeople } from '@/lib/demo';
import type { Match, Person, ProfileInput } from '@/lib/types';

const empty: ProfileInput = { name: '', need: '', offer: '', recognition: '' };
function Avatar({ person, large = false }: { person: Pick<Person, 'name'>; large?: boolean }) {
  const color = ['coral', 'sage', 'lavender', 'sky'][person.name.charCodeAt(0) % 4];
  return <span className={`avatar ${color} ${large ? 'large-avatar' : ''}`} aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>;
}
function ProfileForm({ initial, busy, demo, onSave, onCancel }: { initial?: Person | null; busy: boolean; demo: boolean; onSave: (p: ProfileInput) => Promise<boolean>; onCancel?: () => void }) {
  const [form, setForm] = useState<ProfileInput>(initial || empty);
  const [consent, setConsent] = useState(!!initial);
  const [localError, setLocalError] = useState('');
  function change(field: keyof ProfileInput, value: string) { setForm(old => ({ ...old, [field]: value })); }
  async function submit(e: FormEvent) { e.preventDefault(); if (!consent) { setLocalError('Please confirm you understand who can see your profile.'); return; } setLocalError(''); await onSave(form); }
  function fillDemo() { const p = demoPeople()[0]; setForm({ name: p.name, need: p.need, offer: p.offer, recognition: p.recognition }); }
  return <form className="profile-form" onSubmit={submit}>
    {demo && !initial && <button type="button" className="demo-fill" onClick={fillDemo}><Sparkles size={17}/> Use Maya’s fictional rehearsal profile <ArrowRight size={16}/></button>}
    <label htmlFor="name">First name <span>So people know what to call you.</span></label>
    <input id="name" autoComplete="given-name" required maxLength={40} value={form.name} onChange={e => change('name', e.target.value)} placeholder="Your first name" />
    <label htmlFor="need">I’d like help with… <span>A real question, a stuck moment, or a next step.</span></label>
    <textarea id="need" required minLength={8} maxLength={500} rows={3} value={form.need} onChange={e => change('need', e.target.value)} placeholder="e.g. My first app works on my laptop. How do I put it online?" />
    <div className="field-counter">{form.need.length}/500</div>
    <label htmlFor="offer">I can help with… <span>You don’t need to be an expert to have something to share.</span></label>
    <textarea id="offer" required minLength={8} maxLength={500} rows={3} value={form.offer} onChange={e => change('offer', e.target.value)} placeholder="e.g. I’m good at making a complicated idea easier to explain." />
    <div className="field-counter">{form.offer.length}/500</div>
    <label htmlFor="recognition">How can people spot you? <span>Optional · clothing or another detail you’re happy to share.</span></label>
    <input id="recognition" maxLength={140} value={form.recognition} onChange={e => change('recognition', e.target.value)} placeholder="Green jumper, round glasses" />
    <div className="privacy-note"><Users size={19}/><p><strong>Your profile is visible to this event’s participants.</strong> That includes your name, both answers and recognition description. Messages are private to the two people in a conversation. Your answers are processed by OpenAI to prepare recommendations; messages are not.</p></div>
    {!initial && <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/><span>I understand and want to join.</span></label>}
    <p className="small muted">No account to create. Return using this browser. Clearing browser storage or switching devices won’t automatically restore your profile or messages.</p>
    {localError && <p role="alert" className="error-box">{localError}</p>}
    <div className="form-actions">{onCancel && <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>}<button className="button primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={18}/> : null}{initial ? 'Save my changes' : 'Find my people'}<ArrowRight size={18}/></button></div>
  </form>;
}
function MatchCard({ match, onOpen }: { match: Match; onOpen: () => void }) {
  return <article className="person-card"><div className="person-heading"><Avatar person={match.person}/><div><h3>{match.person.name}</h3><p>{match.person.recognition || 'Say hello in a message'}</p></div><ArrowUpRight size={19}/></div>
    <span className="topic-label">{match.topic.replaceAll('-', ' ')}</span><p className="match-reason">{match.explanation}</p>
    <button className="card-action" onClick={onOpen}>Meet {match.person.name}<ChevronRight size={17}/></button></article>;
}
export default function Meetup({ slug, demo = false }: { slug: string; demo?: boolean }) {
  const app = useMeetup(slug, demo);
  const [tab, setTab] = useState<'discover' | 'people' | 'inbox' | 'profile'>('discover');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [expanded, setExpanded] = useState({ receive: false, give: false });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<{ body: string; id: string; conversation: string } | null>(null);
  const [sendError, setSendError] = useState('');
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const sendingRef = useRef(false);
  const attempted = useRef('');
  const { me, people, active } = app;
  const receive = useMemo(() => demo && me ? recommendations(me, people, 'receive') : app.matches.receive, [demo, me, people, app.matches.receive]);
  const give = useMemo(() => demo && me ? recommendations(me, people, 'give') : app.matches.give, [demo, me, people, app.matches.give]);
  const unread = app.inbox.reduce((n, c) => n + Number(c.unread), 0);
  const conversation = app.conversations.find(c => c.id === active);
  const partner = conversation ? people.find(p => p.id === (conversation.participant_a === me?.id ? conversation.participant_b : conversation.participant_a)) : null;
  const hasAnalysis = !!me?.interpretation && me.interpretation.version === me.answer_version;

  useEffect(() => {
    if (me && !demo && !hasAnalysis && !app.analysing) {
      const key = `${me.id}:${me.answer_version}`;
      if (attempted.current !== key) { attempted.current = key; void app.analyse(); }
    }
  }, [me?.id, me?.answer_version, demo, hasAnalysis, app.analysing]);
  useEffect(() => { if (selected) modalRef.current?.showModal(); else modalRef.current?.close(); }, [selected]);
  useEffect(() => {
    if (active && tab === 'inbox') {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (document.visibilityState === 'visible') void app.markRead(active);
    }
  }, [active, tab, app.messages.at(-1)?.id]);
  useEffect(() => { setSendError(''); setSent(false); }, [active]);
  const openProfile = (p: Person, match?: Match) => { setSelected(p); setSelectedMatch(match || null); };
  async function startChat() {
    if (!selected) return;
    const id = await app.start(selected);
    if (id) { setSelected(null); setTab('inbox'); setDraft(selectedMatch?.question || ''); }
  }
  async function send(retry = false) {
    const payload = retry ? failed : active ? { body: draft.trim(), id: crypto.randomUUID(), conversation: active } : null;
    if (!payload?.body || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setSendError(''); setSent(false);
    try { await app.send(payload.body, payload.id, payload.conversation); if (!retry || draft.trim() === payload.body) setDraft(''); setFailed(null); setSent(true); }
    catch (e) { setFailed(payload); setSendError(e instanceof Error ? e.message : 'Message failed to send.'); }
    finally { sendingRef.current = false; setSending(false); }
  }
  function go(next: typeof tab) { setTab(next); app.setActive(null); setDraft(''); app.setError(''); setSaved(false); }
  async function save(p: ProfileInput) { const ok = await app.save(p); if (ok) { setEditing(false); setSaved(true); setTab('discover'); } return ok; }

  return <div className="app-shell">
    {demo && <div className="demo-banner"><span><Sparkles size={14}/><strong>REHEARSAL</strong> · Fictional people. Messages stay in this browser.</span><Link href="/">About this app <ArrowUpRight size={13}/></Link></div>}
    <header className="app-header"><Link className="brand" href="/"><span className="brand-mark">ai</span>AI pilled<span className="brand-dot"/></Link><span className="event-badge"><span className="live-dot"/>{demo ? 'DEMO ROOM' : 'IN THE ROOM'}</span>{me && <button className="header-profile" onClick={() => go('profile')} aria-label="My profile"><Avatar person={me}/></button>}</header>
    {app.error && <div role="alert" className="error-box global-alert">{app.error}<button className="text-button" onClick={() => { app.setError(''); void app.refresh(); }}>Try again</button></div>}
    {app.loading ? <main className="loading-state" aria-live="polite"><LoaderCircle className="spin"/><h2>Finding your place in the room…</h2></main> : !me ? <main className="join-layout">
      <aside className="join-intro"><span className="eyebrow">A LITTLE HELP GOES A LONG WAY</span><h1>You belong<br /><em>in this room.</em></h1><p>Big question or small stuck moment?<br />There’s probably someone here who gets it.</p><div className="join-steps"><div><span>1</span>Share what you need and what you can offer.</div><div><span>2</span>Find people with a useful connection.</div><div><span>3</span>Send a message. Say hello.</div></div><div className="join-aside-note"><Coffee size={22}/><p>No perfect matches. No exclusive pairs.<br /><strong>Just a starting point for a good conversation.</strong></p></div></aside>
      <section className="join-card"><span className="eyebrow">{demo ? 'TRY IT WITH FICTIONAL PEOPLE' : 'WELCOME TO AI PILLED'}</span><h2>Let’s start with you.</h2><p className="muted">Two short answers. A room of possibilities.</p><ProfileForm busy={app.busy} demo={demo} onSave={save}/></section>
    </main> : <>
      <div className="workspace-layout"><nav className="side-nav" aria-label="Main navigation"><div className="nav-event">YOUR MEETUP<span>AI pilled</span></div>
        <button aria-current={tab === 'discover' ? 'page' : undefined} onClick={() => go('discover')}><Sparkles size={20}/>For you</button>
        <button aria-current={tab === 'people' ? 'page' : undefined} onClick={() => go('people')}><Users size={20}/>The room<span className="nav-count">{people.filter(p => p.id !== me.id).length}</span></button>
        <button aria-current={tab === 'inbox' ? 'page' : undefined} onClick={() => go('inbox')}><MessageCircle size={20}/>Inbox{unread > 0 && <span className="unread-badge">{unread}</span>}</button>
        <button aria-current={tab === 'profile' ? 'page' : undefined} onClick={() => go('profile')}><UserRound size={20}/>My profile</button>
        <div className="nav-note"><HeartHandshake size={26}/><p>You don’t need to know everything to help someone.</p><span>{demo ? 'Fictional rehearsal room' : app.connected ? 'Updates automatically' : 'Reconnecting…'}</span></div>
      </nav>
      <main className="workspace-main">
        {saved && <div className="success-note" role="status"><Check size={16}/>Your profile is saved. You can change it any time.</div>}
        {tab === 'discover' && <>
          <div className="page-intro"><span className="eyebrow">GOOD CONVERSATIONS START HERE</span><h1>A little help.<br className="mobile-only"/> <em>Both ways.</em></h1><p>Hey {me.name}. Here are a few people worth saying hello to.</p></div>
          <div className="connection-note"><span className="note-icon"><HeartHandshake size={23}/></span><p>You might help one person and learn from another.<br/>{' '}<strong>These are independent introductions, not assigned pairs.</strong></p></div>
          {!hasAnalysis && <div className="analysis-note" role="status">{app.analysing ? <><LoaderCircle className="spin" size={18}/>Reading your answers to find useful connections…</> : <><Sparkles size={18}/><div>{demo ? 'Rehearsal matching uses human-labelled fixtures, not live AI. Use Maya’s sample answers to explore matching, or browse the room.' : app.analysisError || 'Your answers are saved. Prepare recommendations when you’re ready.'}{!demo && <button className="text-button" onClick={() => void app.analyse()}>Try preparing recommendations</button>}</div></>}</div>}
          {app.recommendationError && <div className="analysis-note" role="status">{app.recommendationError}</div>}
          {(['receive', 'give'] as const).map(direction => {
            const list = direction === 'receive' ? receive : give;
            return <section className="match-section" key={direction}><div className="section-heading"><div><span className="section-kicker">{direction === 'receive' ? 'A FRESH PAIR OF EYES' : 'SOMETHING YOU CAN SHARE'}</span><h2>{direction === 'receive' ? 'People who could help you' : 'People you could help'}</h2></div><span className={`direction-icon ${direction}`}><ArrowUpRight size={22}/></span></div>
              {list.length ? <><div className="cards-grid">{list.slice(0, expanded[direction] ? undefined : 3).map(match => <MatchCard key={match.person.id} match={match} onOpen={() => openProfile(match.person, match)}/>)}</div>{list.length > 3 && <button className="text-button explore" onClick={() => setExpanded(old => ({ ...old, [direction]: !old[direction] }))}>{expanded[direction] ? 'Show fewer' : `Explore ${list.length - 3} more`}<ArrowRight size={16}/></button>}</> : <div className="empty-state compact"><Users size={25}/><h3>{app.analysing ? 'Preparing your introductions…' : app.recommendationError ? 'Recommendations are temporarily unavailable.' : hasAnalysis ? 'No relevant recommendations yet.' : 'No recommendations to show yet.'}</h3><p>{hasAnalysis ? 'We’ll update this as people join or change their answers. You can still explore the room.' : 'We won’t guess or substitute keyword matches.'}</p><button className="text-button" onClick={() => go('people')}>Explore the room <ArrowRight size={16}/></button></div>}
            </section>;
          })}
          <p className="matching-footnote"><Sparkles size={14}/>Introductions are based on what people actually wrote—not job titles or compatibility scores.</p>
        </>}
        {tab === 'people' && <><div className="page-intro"><span className="eyebrow">DIFFERENT BACKGROUNDS. SHARED CURIOSITY.</span><h1>Meet <em>the room.</em></h1><p>Browse everyone. A recommendation isn’t required to say hello.</p></div><label className="search-label" htmlFor="search">Find a name or topic</label><input className="search-input" id="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names, questions or offers…"/>
          <div className="cards-grid room-grid">{people.filter(p => p.id !== me.id && `${p.name} ${p.need} ${p.offer}`.toLowerCase().includes(search.toLowerCase())).map(person => <article className="person-card" key={person.id}><div className="person-heading"><Avatar person={person}/><div><h3>{person.name}</h3><p>{person.recognition || 'Here to connect'}</p></div></div><span className="section-kicker">I’D LIKE HELP WITH</span><p className="clamp-three">{person.need}</p><span className="section-kicker">I CAN HELP WITH</span><p className="clamp-three">{person.offer}</p><button className="card-action" onClick={() => openProfile(person)}>View profile <ArrowUpRight size={16}/></button></article>)}</div>
          {!people.some(p => p.id !== me.id && `${p.name} ${p.need} ${p.offer}`.toLowerCase().includes(search.toLowerCase())) && <div className="empty-state"><Users/><h3>{search ? 'No profiles found.' : 'You’re early. Welcome!'}</h3><p>{search ? 'Try a different name or topic.' : 'Other participants will appear here as they join.'}</p></div>}
        </>}
        {tab === 'profile' && <><div className="page-intro"><span className="eyebrow">A LITTLE ABOUT YOU</span><h1>Your corner <em>of the room.</em></h1><p>Changed your mind or got unstuck? Keep your answers up to date.</p></div><section className="profile-detail own-profile"><div className="profile-title"><Avatar person={me} large/><div><h2>{me.name}</h2><p>{me.recognition || 'Add a recognition description to help people find you.'}</p></div></div>{editing ? <ProfileForm initial={me} busy={app.busy} demo={demo} onSave={save} onCancel={() => setEditing(false)}/> : <><span className="section-kicker">I’D LIKE HELP WITH</span><p className="answer-text">{me.need}</p><span className="section-kicker">I CAN HELP WITH</span><p className="answer-text">{me.offer}</p><button className="button primary" onClick={() => setEditing(true)}>Edit my profile <ArrowUpRight size={17}/></button><p className="small muted">Visible to participants in this event. Messages remain private. Access is tied to this browser’s saved session.</p></>}</section></>}
        {tab === 'inbox' && <><div className="page-intro inbox-intro"><span className="eyebrow">TAKE IT FROM HERE</span><h1>Say <em>hello.</em></h1><p>Private conversations. Real connections.</p></div>
          <div className={`inbox-layout ${active ? 'chat-open' : ''}`}><section className="conversation-list" aria-label="Conversations">{app.conversations.length ? [...app.conversations].sort((a, b) => (app.inbox.find(i => i.conversation_id === b.id)?.last_message_at || '').localeCompare(app.inbox.find(i => i.conversation_id === a.id)?.last_message_at || '')).map(c => {
            const person = people.find(p => p.id === (c.participant_a === me.id ? c.participant_b : c.participant_a));
            const item = app.inbox.find(i => i.conversation_id === c.id);
            return <button key={c.id} className={`conversation-row ${active === c.id ? 'active' : ''}`} onClick={() => { setDraft(''); app.setActive(c.id); }}><Avatar person={person || { name: '?' }}/><span><strong>{person?.name || 'Participant'}</strong><span>{item?.preview || 'Start the conversation'}</span></span>{Number(item?.unread) > 0 && <span className="unread-badge" aria-label={`${item!.unread} unread messages`}>{item!.unread}</span>}</button>;
          }) : <div className="empty-state"><MessageCircle/><h3>Your next hello starts here.</h3><p>Open a profile to start a conversation.</p><button className="text-button" onClick={() => go('people')}>Meet the room <ArrowRight size={16}/></button></div>}</section>
          <section className="chat-panel" aria-label={partner ? `Conversation with ${partner.name}` : 'Select a conversation'}>{active && partner ? <><div className="chat-header"><button className="icon-button mobile-only" aria-label="Back to inbox" onClick={() => app.setActive(null)}><ArrowLeft size={20}/></button><Avatar person={partner}/><button className="chat-name" onClick={() => openProfile(partner)}><strong>{partner.name}</strong><span>{partner.recognition || 'View profile'}</span></button><span className="private-label">PRIVATE</span></div>
            <div className="message-list" role="log" aria-live="polite" aria-label="Messages"><p className="chat-privacy">Only you and {partner.name} can read this conversation.{demo ? ' Rehearsal messages are stored locally.' : ' Messages are never used for AI matching.'}</p>{!app.messages.length && <p className="chat-prompt">A simple hello is a good place to start.</p>}{app.messages.length === 100 && <p className="small muted">Showing the latest 100 messages.</p>}{app.messages.map(m => <div key={m.id} className={`message ${m.sender_id === me.id ? 'mine' : ''}`}><p>{m.body}</p><span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.sender_id === me.id && <> · Sent <Check size={11}/></>}</span></div>)}<div ref={endRef}/></div>
            {demo && <button className="simulate-button" onClick={app.simulateReply}>Rehearsal: simulate a reply from {partner.name}</button>}
            {sendError && <div className="send-error" role="alert"><p>{sendError}</p>{failed?.conversation === active && <button className="text-button" disabled={sending} onClick={() => void send(true)}>Retry failed message</button>}</div>}
            <form className="message-composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="sr-only" htmlFor="message">Message to {partner.name}</label><textarea id="message" rows={2} maxLength={2000} value={draft} disabled={sending} onChange={e => { setDraft(e.target.value); setSent(false); }} placeholder={`Say hello to ${partner.name}…`}/><button className="send-button" aria-label="Send message" disabled={!draft.trim() || sending || !!failed} type="submit">{sending ? <LoaderCircle className="spin" size={19}/> : <Send size={19}/>}</button></form><div className="composer-status" role="status">{sending ? 'Sending…' : failed ? <><span>Failed message saved for retry.</span><button className="text-button" onClick={() => { setFailed(null); setSendError(''); }}>Discard failed attempt</button></> : sent ? 'Sent' : 'Text only · 2,000 characters maximum'}</div>
          </> : <div className="empty-state chat-placeholder"><MessageCircle size={36}/><h3>A little message.<br/>A useful conversation.</h3><p>Choose a conversation or say hello to someone new.</p></div>}</section></div>
        </>}
      </main></div>
      <nav className="bottom-nav" aria-label="Mobile navigation">{([{ id: 'discover', label: 'For you', icon: Sparkles }, { id: 'people', label: 'The room', icon: Users }, { id: 'inbox', label: 'Inbox', icon: MessageCircle }, { id: 'profile', label: 'You', icon: UserRound }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={21}/><span>{item.label}</span>{item.id === 'inbox' && unread > 0 && <span className="bottom-unread">{unread}</span>}</button>)}</nav>
    </>}
    <dialog ref={modalRef} className="profile-modal" onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }} onClose={() => setSelected(null)} aria-labelledby="profile-modal-title">{selected && <><button className="modal-close icon-button" onClick={() => setSelected(null)} aria-label="Close profile"><X size={22}/></button><div className="profile-title"><Avatar person={selected} large/><div><span className="eyebrow">{demo ? 'FICTIONAL PARTICIPANT' : 'IN YOUR ROOM'}</span><h2 id="profile-modal-title">Meet {selected.name}.</h2></div></div>{selected.recognition && <p className="recognition"><Coffee size={17}/>{selected.recognition}</p>}<span className="section-kicker">I’D LIKE HELP WITH</span><p className="answer-text">{selected.need}</p><span className="section-kicker">I CAN HELP WITH</span><p className="answer-text">{selected.offer}</p>{selectedMatch && <div className="opening-question"><span className="section-kicker">A WAY TO BREAK THE ICE</span><p>{selectedMatch.question}</p></div>}<button className="button primary full-width" onClick={() => void startChat()}><MessageCircle size={18}/>Message {selected.name}<ArrowUpRight size={18}/></button><p className="small muted centered">No introduction required. A friendly message is enough.</p></>}</dialog>
  </div>;
}
