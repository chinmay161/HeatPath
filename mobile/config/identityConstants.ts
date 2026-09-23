/**
 * Identity Constants
 * Centralized constant values for cross-platform user identity and authentication headers.
 */

export const IDENTITY_PREFIX_GUEST = 'guest|';
export const IDENTITY_PREFIX_AUTH0 = 'auth0|';

export const HEADER_GUEST_ID = 'X-Guest-ID';
export const HEADER_AUTHORIZATION = 'Authorization';

export const STORAGE_KEY_GUEST_ID = 'heatpath_guest_identity_id';
export const STORAGE_KEY_AUTH_TOKEN = 'heatpath_auth_token';

/**
 * RFC4122 v4 UUID validation pattern (36 characters with hyphens: 8-4-4-4-12)
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
