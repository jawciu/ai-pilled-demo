import type { Match, Person, Topic } from './types';

export function cosine(a?: number[], b?: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; }
  return x && y ? dot / Math.sqrt(x * y) : 0;
}

function pairScore(need: Topic, offer: Topic) {
  if (!need.specific || !offer.specific) return 0;
  const exact = need.topic.toLowerCase() === offer.topic.toLowerCase();
  const semantic = cosine(need.vector, offer.vector);
  if (!exact && semantic < 0.84) return 0;
  return (exact ? 2 : 0) + semantic + Math.min(need.evidence.length, offer.evidence.length, 100) / 1000;
}

export function recommendations(me: Person, people: Person[], direction: 'receive' | 'give'): Match[] {
  if (!me.interpretation || me.interpretation.version !== me.answer_version) return [];
  const mine = direction === 'receive' ? me.interpretation.needs : me.interpretation.offers;
  return people.filter(p => p.id !== me.id && p.event_id === me.event_id && p.interpretation?.version === p.answer_version)
    .flatMap(person => {
      const theirs = direction === 'receive' ? person.interpretation!.offers : person.interpretation!.needs;
      let best: { need: Topic; offer: Topic; score: number } | undefined;
      for (const a of mine) for (const b of theirs) {
        const need = direction === 'receive' ? a : b;
        const offer = direction === 'receive' ? b : a;
        const score = pairScore(need, offer);
        if (score > 0 && (!best || score > best.score)) best = { need, offer, score };
      }
      if (!best) return [];
      const { need, offer, score } = best;
      return [{ person, score, topic: need.topic,
        explanation: direction === 'receive'
          ? `You asked for “${need.evidence}”. ${person.name} offered “${offer.evidence}”.`
          : `${person.name} asked for “${need.evidence}”. You offered “${offer.evidence}”.`,
        question: direction === 'receive'
          ? `Hi ${person.name}! You mentioned “${offer.evidence}”. Could we talk about my question: “${need.evidence}”?`
          : `Hi ${person.name}! You mentioned “${need.evidence}”. I offered “${offer.evidence}” — would a chat be useful?`
      }];
    }).sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
}
