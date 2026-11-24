export class AnalysisRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter: string | null = null) {
    super(message);
  }
}
export function analysisRetryDelay(error: unknown, now = Date.now()): number | null {
  const transient = error instanceof TypeError || (error instanceof AnalysisRequestError && [429,502,503].includes(error.status));
  if (!transient) return null;
  const header = error instanceof AnalysisRequestError ? error.retryAfter : null;
  if (!header?.trim()) return 60000;
  const numeric = Number(header);
  const delay = Number.isFinite(numeric) ? numeric * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(1000,Math.min(delay,2147483647)) : 60000;
}

// Three automatic attempts per profile-answer version. An explicit later call
// still permits a manual attempt, without resetting the automatic retry budget.
export function createAnalysisRetry(options: {
  perform: (signal: AbortSignal) => Promise<unknown>;
  onSuccess: () => Promise<unknown>;
  onError: (error: unknown, retrying: boolean) => void;
  onBusy: (busy: boolean) => void;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  unschedule?: (timer: ReturnType<typeof setTimeout>) => void;
}) {
  const schedule=options.schedule || setTimeout;
  const unschedule=options.unschedule || clearTimeout;
  let key: string | null=null, generation=0, attempts=0;
  let controller: AbortController | null=null;
  let timer: ReturnType<typeof setTimeout> | null=null;
  function setKey(next: string | null) {
    if (key===next) return;
    key=next;generation++;attempts=0;
    if(timer!==null) unschedule(timer);
    timer=null;controller?.abort();controller=null;
    options.onBusy(false);
  }
  async function run() {
    if(!key || controller || timer!==null) return;
    const current=generation;
    const request=new AbortController();controller=request;attempts++;
    options.onBusy(true);
    try {
      await options.perform(request.signal);
      if(current!==generation) return;
      await options.onSuccess();
    } catch(error) {
      if(current!==generation || request.signal.aborted) return;
      const delay=analysisRetryDelay(error);
      const retrying=delay!==null && attempts<3;
      options.onError(error,retrying);
      if(retrying) timer=schedule(()=>{timer=null;void run();},delay);
    } finally {
      if(current===generation) {controller=null;options.onBusy(false);}
    }
  }
  return {setKey,run};
}
