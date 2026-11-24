// Bound reads and AI requests so a dropped connection cannot leave a browser
// permanently busy. Callers explicitly pass the signal to abortable operations.
export async function withRequestTimeout<T>(
  perform: (signal: AbortSignal) => PromiseLike<T>,
  milliseconds = 15000,
  outerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    const stop = (reason: DOMException) => { controller.abort(reason); reject(reason); };
    cancel = () => stop(new DOMException('Request cancelled.', 'AbortError'));
    if (outerSignal?.aborted) cancel();
    else outerSignal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => stop(new DOMException('Connection timed out. Please try again.', 'TimeoutError')), milliseconds);
  });
  try {
    return await Promise.race([interrupted, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return perform(controller.signal);
    })]);
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', cancel);
  }
}
