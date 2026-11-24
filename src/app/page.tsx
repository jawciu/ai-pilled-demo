import Link from 'next/link';
import Brand from '@/components/brand';
import { ArrowUpRight, ArrowRight, Sparkles, MessageCircle, HeartHandshake } from 'lucide-react';
export default function Home() {
  return <main className="landing">
    <header className="landing-header"><Link className="brand" href="/"><Brand/></Link><span className="eyebrow">BETTER TOGETHER, IN PERSON</span></header>
    <section className="landing-grid">
      <div className="landing-copy"><span className="pill"><span className="live-dot" /> THE MEETUP COMPANION</span>
        <h1>Your next breakthrough<br />might be <em>in this room.</em></h1>
        <p>You have a question. Someone here has a little know-how.<br className="desktop-only" /> Let’s help you find each other.</p>
        <Link className="button primary large" href="/demo">Explore the rehearsal <ArrowUpRight size={20} /></Link>
        <p className="small muted">At the meetup? Scan the organiser’s QR code to join the live event.</p>
        <div className="landing-proof"><span className="avatar-stack"><span>M</span><span>T</span><span>P</span></span><span>Different backgrounds.<br /><strong>Something to offer.</strong></span></div>
      </div>
      <div className="landing-art" aria-label="Example of a helpful introduction"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-star"><Sparkles size={32}/></span>
        <div className="floating-note"><HeartHandshake size={18}/> A good place to start</div>
        <div className="intro-card"><div className="card-top"><span className="avatar large-avatar coral">M</span><span className="tag">DEMO PROFILE</span></div><h2>Meet Maya.</h2><p>Building her first app.<br />Big ideas. One stubborn bug.</p><div className="intro-quote">“I’d love a second pair of eyes on my code.”</div><div className="intro-footer"><span><span className="live-dot"/> A conversation waiting to happen</span><ArrowUpRight size={20}/></div></div>
        <div className="floating-message"><MessageCircle size={19}/><span>“I can help with that!”</span></div>
      </div>
    </section>
    <section className="how-it-works"><div><span>01</span><h3>A little about you</h3><p>What you need. What you can share.</p></div><div><span>02</span><h3>Find a useful connection</h3><p>Practical introductions, not popularity scores.</p></div><div><span>03</span><h3>Say hello, in real life</h3><p>Send a message. Start a conversation. <ArrowRight size={14}/></p></div></section>
    <footer className="landing-footer">Built for a room full of possibilities.<span>No swiping. No perfect pairs. Just people.</span></footer>
  </main>;
}
