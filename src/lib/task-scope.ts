import type { MatchReview, Person } from './types';

function taskFamily(topic: string): string | null {
  const value=topic.toLowerCase();
  if (/translat|interpreting-languages/.test(value)) return 'translation';
  if (/privacy|redact|anonym|confidential|data-protection/.test(value)) return 'privacy';
  if (/interview|user-research|customer-research|discovery|idea-validation|customer-validation/.test(value)) return 'research';
  if (/scoping|prioriti|feature-selection|project-planning|mvp-planning/.test(value)) return 'scoping';
  if (/writing|copywriting|communication|plain-language|description-rewriting/.test(value)) return 'writing';
  if (/deploy|production|productization|productisation|hosting|publishing/.test(value)) return 'shipping';
  if (/debug|css|react|pandas|flexbox|media-quer|code-review/.test(value)) return 'implementation';
  if (/visual|interface|graphic-design|ui-design|typograph|colour|color|photoshop/.test(value)) return 'visual-design';
  if (/automat|spreadsheet|csv-processing/.test(value)) return 'automation';
  return null;
}
export function readabilityScopeException(requester: Person, helper: Person) {
  const offered=(helper.interpretation?.offers||[]).map(t=>taskFamily(t.topic));
  const readabilityQuestion=/\b(readab\w*|easier to read|hard to read|colour contrast|color contrast|pale.grey|text sizes?|font sizes?)\b/i.test(requester.need);
  const implementationQuestion=/\b(debug\w*|css|javascript|code|flexbox|media.quer\w*|implement\w*|fix\w*|broken|breaks?)\b/i.test(requester.need);
  return readabilityQuestion && !implementationQuestion && offered.includes('visual-design');
}
export function staleReadabilityRejection(review: MatchReview, requester: Person, helper: Person) {
  return review.status === 'ready' && review.decision?.level === 'none' && review.decision.scope_policy !== 2 && readabilityScopeException(requester,helper);
}
export function compatibleTaskScope(requester: Person, helper: Person) {
  const needs=requester.interpretation?.needs||[],offers=helper.interpretation?.offers||[];
  const requested=needs.map(t=>taskFamily(t.topic)),offered=offers.map(t=>taskFamily(t.topic));
  if (readabilityScopeException(requester,helper)) return true;
  if (!requested.length || !offered.length || requested.includes(null) || offered.includes(null)) return true;
  return requested.some(family=>offered.includes(family));
}
