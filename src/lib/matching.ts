import type { Match, Person, Topic } from './types';

export function cosine(a?: number[], b?: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; }
  return x && y ? dot / Math.sqrt(x * y) : 0;
}

const topicAliases: Record<string, string> = {
  productization: 'production-readiness',
  productisation: 'production-readiness',
  'demo-to-production': 'production-readiness',
  'prototype-to-production': 'production-readiness',
  'ui-design': 'interface-design',
  'user-interface-design': 'interface-design',
  'graphic-design': 'visual-design'
};
const coveredNeeds: Record<string, readonly string[]> = {
  'production-readiness': ['deployment', 'web-deployment'],
  'vercel-deployment': ['deployment', 'web-deployment', 'nextjs-deployment'],
  'nextjs-deployment': ['deployment', 'web-deployment'],
  'web-deployment': ['deployment'],
  'app-store-deployment': ['deployment', 'mobile-app-deployment'],
  'mobile-app-deployment': ['deployment'],
  'interface-design': ['visual-design', 'design-feedback'],
  'visual-design': ['interface-design', 'design-feedback']
};
const deploymentPlatforms: Record<string, string> = {
  'vercel-deployment': 'web', 'nextjs-deployment': 'web', 'web-deployment': 'web',
  'app-store-deployment': 'mobile', 'mobile-app-deployment': 'mobile', 'flutter-deployment': 'mobile'
};
const debuggingTools: Record<string, string> = {
  'react-debugging': 'react', 'pandas-debugging': 'pandas'
};
function canonicalTopic(topic: string) {
  const normalised = topic.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return topicAliases[normalised] || normalised;
}
function conflictingTools(need: string, offer: string) {
  return [deploymentPlatforms, debuggingTools].some(group => group[need] && group[offer] && group[need] !== group[offer]);
}
function pairScore(need: Topic, offer: Topic) {
  if (!need.specific || !offer.specific) return 0;
  const requested = canonicalTopic(need.topic);
  const offered = canonicalTopic(offer.topic);
  if (conflictingTools(requested, offered)) return 0;
  const semantic = cosine(need.vector, offer.vector);
  const detail = Math.min(need.evidence.length, offer.evidence.length, 100) / 1000;
  if (requested === offered) return 3 + Math.max(0, semantic) + detail;
  if (coveredNeeds[offered]?.includes(requested)) return 2.5 + Math.max(0, semantic) / 4 + detail;
  return semantic >= 0.84 ? 1 + semantic + detail : 0;
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
