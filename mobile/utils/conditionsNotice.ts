/**
 * User-facing status for the home "conditions" card: one short message per
 * failure class, in Patho's voice, and never in developer terms.
 */
import type { ApiFailureClass } from '../config/apiErrors';

export type ConditionsNoticeKind =
  | 'waking' // still retrying while the server wakes
  | 'waking_gave_up' // the retry budget ran out
  | 'offline'
  | 'provider_unavailable'
  | 'location'
  | 'unknown';

export type ConditionsNotice = {
  kind: ConditionsNoticeKind;
  text: string;
  showRetry: boolean;
};

export const CONDITIONS_MESSAGES: Record<ConditionsNoticeKind, string> = {
  waking: 'Patho is waking the server up. This can take up to a minute.',
  waking_gave_up: "Patho couldn't wake the server up. Try again in a moment.",
  offline: "You're offline. Connect to see live conditions.",
  provider_unavailable: 'Live weather is temporarily unavailable. Try again in a few minutes.',
  location: 'Turn on location to see live conditions here.',
  unknown: 'Something went wrong loading conditions.',
};

const notice = (kind: ConditionsNoticeKind, showRetry = false): ConditionsNotice => ({
  kind,
  text: CONDITIONS_MESSAGES[kind],
  showRetry,
});

/**
 * Pick the notice to show, or null when the card should show its normal
 * loading or data state.
 */
export function getConditionsNotice(input: {
  loading: boolean;
  waking: boolean;
  failure: ApiFailureClass | null;
  /** Coordinates to load conditions for (GPS or a picked start point). */
  hasLocation: boolean;
  /** Conditions loaded with a usable feels-like value. */
  hasData: boolean;
}): ConditionsNotice | null {
  const { loading, waking, failure, hasLocation, hasData } = input;

  if (loading) return waking ? notice('waking') : null;
  if (!hasLocation) return notice('location');

  switch (failure) {
    case 'waking':
      return notice('waking_gave_up', true);
    case 'offline':
      return notice('offline', true);
    case 'provider_unavailable':
      return notice('provider_unavailable', true);
    case 'client':
    case 'unknown':
      return notice('unknown', true);
  }

  if (hasData) return null;
  // Loaded but nothing usable came back
  return notice('unknown', true);
}
