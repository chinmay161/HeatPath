/**
 * Retries a request while the server is waking (Render free-tier cold start, ~50 s),
 * with exponential backoff inside a fixed total budget. Any other failure class
 * stops immediately, since retrying would not help.
 */
import { ApiError, DEFAULT_API_TIMEOUT_MS, classifyFailure } from './apiErrors';

export const WAKE_RETRY_BUDGET_MS = 90_000;
export const WAKE_RETRY_INITIAL_DELAY_MS = 2_000;
export const WAKE_RETRY_MAX_DELAY_MS = 10_000;

export type WakeRetryOptions = {
  /** Total time across all attempts and waits. */
  budgetMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Upper bound for one attempt; each attempt also gets no more than the budget left. */
  attemptTimeoutMs?: number;
  /** Called after an attempt fails as 'waking' and another will follow. */
  onWaking?: (attempt: number) => void;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

function abortError(): Error {
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run `attempt` until it succeeds, fails with a class other than 'waking',
 * or the budget runs out. `attempt` receives the timeout to use for that try.
 * Rethrows the last error (an ApiError classed 'waking' when the budget ran out).
 */
export async function retryWhileWaking<T>(
  attempt: (timeoutMs: number) => Promise<T>,
  options: WakeRetryOptions = {},
): Promise<T> {
  const {
    budgetMs = WAKE_RETRY_BUDGET_MS,
    initialDelayMs = WAKE_RETRY_INITIAL_DELAY_MS,
    maxDelayMs = WAKE_RETRY_MAX_DELAY_MS,
    attemptTimeoutMs = DEFAULT_API_TIMEOUT_MS,
    onWaking,
    signal,
    now = Date.now,
    sleep = defaultSleep,
  } = options;

  const startedAt = now();
  let delay = initialDelayMs;

  for (let tries = 1; ; tries++) {
    if (signal?.aborted) throw abortError();
    const remaining = budgetMs - (now() - startedAt);
    try {
      return await attempt(Math.max(1, Math.min(attemptTimeoutMs, remaining)));
    } catch (error) {
      if (signal?.aborted || (error as Error)?.name === 'AbortError') throw error;
      if (classifyFailure(error) !== 'waking') throw error;

      // Stop if waiting and trying again would not fit in the budget
      const elapsed = now() - startedAt;
      if (elapsed + delay >= budgetMs) {
        throw error instanceof ApiError ? error : new ApiError('waking', 'Server did not wake up in time');
      }
      onWaking?.(tries);
      await sleep(delay, signal);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
