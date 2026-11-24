import type { MatchReview, Person } from './types';

function taskFamilies(topic: string): string[] {
  const value=topic.toLowerCase();
  const families: string[] = [];
  if (/translat|interpreting-languages/.test(value)) families.push('translation');
  if (/privacy|redact|anonym|confidential|data-protection/.test(value)) families.push('privacy');
  if (/interview|user-research|customer-research|discovery|idea-validation|customer-validation/.test(value)) families.push('research');
  if (/scoping|prioriti|feature-selection|project-planning|mvp-planning/.test(value)) families.push('scoping');
  if (/writing|copywriting|communication|plain-language|description-rewriting/.test(value)) families.push('writing');
  if (/deploy|production|productization|productisation|hosting|publishing/.test(value)) families.push('shipping');
  if (/debug|css|react|pandas|flexbox|media-quer|code-review/.test(value)) families.push('implementation');
  if (/visual|interface|graphic-design|ui-design|typograph|colour|color|photoshop/.test(value)) families.push('visual-design');
  if (/automat|spreadsheet|csv-processing/.test(value)) families.push('automation');
  return families;
}
export function readabilityScopeException(requester: Person, helper: Person) {
  const offered=(helper.interpretation?.offers||[]).flatMap(t=>taskFamilies(t.topic));
  const readabilityQuestion=/\b(readab\w*|easier to read|hard to read|colour contrast|color contrast|pale.grey|text sizes?|font sizes?)\b/i.test(requester.need);
  const implementationQuestion=/\b(debug\w*|css|javascript|code|flexbox|media.quer\w*|implement\w*)\b/i.test(requester.need);
  return readabilityQuestion && !implementationQuestion && offered.includes('visual-design');
}
export function staleReadabilityRejection(review: MatchReview, requester: Person, helper: Person) {
  return review.status === 'ready' && review.decision?.level === 'none' && (review.decision.scope_policy || 0) < 2 && readabilityScopeException(requester,helper);
}
export function compatibleTaskScope(requester: Person, helper: Person) {
  const needs=requester.interpretation?.needs||[],offers=helper.interpretation?.offers||[];
  const requested=needs.flatMap(t=>taskFamilies(t.topic)),offered=offers.flatMap(t=>taskFamilies(t.topic));
  if (readabilityScopeException(requester,helper)) return true;
  if (!requested.length || !offered.length || needs.some(t=>!taskFamilies(t.topic).length) || offers.some(t=>!taskFamilies(t.topic).length)) return true;
  return requested.some(family=>offered.includes(family));
}
