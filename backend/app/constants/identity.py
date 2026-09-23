"""
Identity Constants (Backend)

Centralized constants and regex validation rules for user identities and headers.
"""

IDENTITY_PREFIX_GUEST = "guest|"
IDENTITY_PREFIX_AUTH0 = "auth0|"

HEADER_GUEST_ID = "X-Guest-ID"
HEADER_AUTHORIZATION = "Authorization"

# RFC4122 v4 UUID regex (case-insensitive, 36 chars with hyphens)
UUID_V4_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
