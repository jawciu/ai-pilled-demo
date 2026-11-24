import { reviewAnswers, type ReviewDecision, type ReviewInput } from './ai-matching';
import { reviewIsCurrent } from './reviewed-matching';
import { compatibleTaskScope } from './task-scope';
import type { MatchReview, Person } from './types';

export function partitionReviewJobs(jobs: MatchReview[], people: Map<string,Person>) {
  const valid: MatchReview[] = [], obsolete: MatchReview[] = [];
  for (const job of jobs) {
    const a=people.get(job.requester_id),b=people.get(job.helper_id);
    (a && b && reviewIsCurrent(job,a,b) ? valid : obsolete).push(job);
  }
  return {valid,obsolete};
}

// A lease identifies a batch, never an individual decision. Map by ordered pair.
export async function prepareReviewBatch(jobs: MatchReview[], people: Map<string,Person>,
  evaluate: (inputs: ReviewInput[]) => Promise<ReviewDecision[]> = reviewAnswers) {
  const {valid}=partitionReviewJobs(jobs,people);
  const candidates=valid.filter(job=>compatibleTaskScope(people.get(job.requester_id)!,people.get(job.helper_id)!));
  const decisions=candidates.length ? await evaluate(candidates.map(job=>({need:people.get(job.requester_id)!.need,offer:people.get(job.helper_id)!.offer}))) : [];
  if (decisions.length!==candidates.length) throw new Error('Incomplete matching review');
  const byPair=new Map(candidates.map((job,index)=>[`${job.requester_id}:${job.helper_id}`,decisions[index]]));
  return valid.map(job=>{
    const {index:_index,...decision}=byPair.get(`${job.requester_id}:${job.helper_id}`) || {
      index:0,level:'none' as const,coverage:'none' as const,need_evidence:'',offer_evidence:'',topic:'',opening:''
    };
    return {job,decision};
  });
}
