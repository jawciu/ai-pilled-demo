export type Topic = { topic: string; summary: string; evidence: string; specific: boolean; vector?: number[] };
export type Interpretation = { needs: Topic[]; offers: Topic[]; version: number; model: string; pipeline?: number };
export type Person = {
  id: string; event_id: string; name: string; need: string; offer: string; recognition: string;
  answer_version: number; interpretation: Interpretation | null; updated_at: string; demo?: boolean;
};
export type ProfileInput = Pick<Person, 'name' | 'need' | 'offer' | 'recognition'>;
export type Conversation = { id: string; event_id: string; participant_a: string; participant_b: string; created_at: string };
export type Message = { id: string; conversation_id: string; sender_id: string; body: string; client_id: string; created_at: string };
export type ReadReceipt = { conversation_id: string; participant_id: string; last_read_at: string };
export type MatchReview = {
  event_id: string; requester_id: string; helper_id: string;
  requester_version: number; helper_version: number; revision: number;
  status: 'processing' | 'ready' | 'failed'; lease_id: string; lease_until: string;
  decision: { level: 'direct' | 'related' | 'none'; need_evidence: string; offer_evidence: string; topic: string; opening: string; scope_policy?: number } | null;
};
export type Match = { person: Person; explanation: string; question: string; topic: string; score: number };
