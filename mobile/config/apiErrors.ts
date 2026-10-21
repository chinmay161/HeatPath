/**
 * Classifies API request failures so screens can show the right message:
 * a sleeping server (Render free-tier cold start), no connectivity, an upstream
 * provider outage, a bad request, or something else.
 */

export type ApiFailureClass =
  | 'waking' // network error, timeout, or a proxy 502/503/504 page: the server is probably asleep or restarting
  | 'offline' // the device has no connectivity
  | 'provider_unavailable' // the server is up but its weather/routing provider is not
  | 'client' // 4xx: the request itself was rejected
  | 'unknown';

export const DEFAULT_API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly kind: ApiFailureClass;
  readonly status?: number;
  readonly body?: unknown;

  constructor(kind: ApiFailureClass, message: string, options: { status?: number; body?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.body = options.body;
  }
}

/**
 * False only when the platform reports no connectivity (navigator.onLine on web).
 * Native has no equivalent without NetInfo, so it is treated as online.
 */
export function isOnline(): boolean {
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  return nav?.onLine !== false;
}

/** fetch rejects with a TypeError on network failure (web: "Failed to fetch", RN: "Network request failed"). */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network request failed|failed to fetch|networkerror|load failed|timed? ?out/i.test(message);
}

/**
 * Classify any error thrown by apiFetch / apiFetchJson (or by fetch itself).
 * ApiErrors carry their class; anything else thrown before a response arrived is
 * offline, waking (network error/timeout) or unknown.
 */
export function classifyFailure(error: unknown, online: boolean = isOnline()): ApiFailureClass {
  if (error instanceof ApiError) return error.kind;
  if (!online) return 'offline';
  if (isNetworkError(error)) return 'waking';
  return 'unknown';
}

/** True when the body is a JSON object from our API, not a proxy's HTML error page. */
function isApiJsonBody(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

/**
 * Classify a response. Returns null when it is a success that callers should use.
 * `body` is the parsed JSON, or undefined when the response was not JSON.
 *
 * - 502/503/504 without our JSON body: Render's proxy page while the service
 *   deploys or restarts, so 'waking'.
 * - 503 with our JSON body, or a 200 whose body says status:"unavailable":
 *   our weather/routing provider is down, so 'provider_unavailable'.
 * - 502 with our JSON body: an upstream (ORS) error we passed on, so 'unknown'.
 */
export function classifyResponse(status: number, body?: unknown): ApiFailureClass | null {
  const ours = isApiJsonBody(body);
  if ((status === 502 || status === 503 || status === 504) && !ours) return 'waking';
  if (status === 503) return 'provider_unavailable';
  if (status >= 400 && status < 500) return 'client';
  if (status < 200 || status >= 300) return 'unknown';
  if (ours && body.status === 'unavailable') return 'provider_unavailable';
  return null;
}
