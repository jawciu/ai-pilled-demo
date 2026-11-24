import type { Metadata } from 'next';
import styles from './qr.module.css';

export const metadata: Metadata = { title: 'Join the room · AI pilled' };
const attendeeRoom = '/e/ai-pilled-room-84e2c9b7';

export default function QRPage() {
  return <main className={styles.page}>
    <div className={`brand ${styles.brand}`} aria-label="AI pilled">
      <span className={`brand-mark ${styles.mark}`}>ai</span><span className="brand-name">pilled</span>
    </div>
    <section className={styles.content} aria-labelledby="join-title">
      <h1 id="join-title">Join <em>the room.</em></h1>
      <a className={styles.code} href={attendeeRoom} aria-label="Open the attendee room">
        <img src="/attendee-qr.png" width={1024} height={1024} alt="Scan this QR code to join the AI pilled meetup" />
      </a>
      <p>Scan with your phone.</p>
    </section>
  </main>;
}
