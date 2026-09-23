"""
Identity Resolution Service

Resolves user identity from incoming HTTP requests.
Acts as a reusable FastAPI dependency (resolve_identity).

Resolution Hierarchy:
1. Authorization: Bearer <Auth0 JWT> -> Verified against Auth0 JWKS -> returns auth0|<sub>
2. X-Guest-ID: guest|<uuid-v4> -> Validated against RFC4122 v4 UUID -> returns guest|<uuid>
3. Neither -> Raises HTTP 401 Unauthorized.
Malformed guest ID -> Raises HTTP 400 Bad Request.
"""

import re
import logging
import uuid
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status

from app.constants.identity import (
    IDENTITY_PREFIX_GUEST,
    IDENTITY_PREFIX_AUTH0,
    HEADER_GUEST_ID,
    HEADER_AUTHORIZATION,
    UUID_V4_PATTERN,
)
from app.services.auth0 import verify_auth0_token, normalize_auth0_user_id

logger = logging.getLogger("app.identity")
_uuid_v4_regex = re.compile(UUID_V4_PATTERN, re.IGNORECASE)


def extract_request_context(request: Request) -> Dict[str, str]:
    """Extract diagnostic metadata for structured logging without exposing sensitive data."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host

    platform = request.headers.get("X-Platform")
    user_agent = request.headers.get("User-Agent", "")
    if not platform:
        ua_lower = user_agent.lower()
        if "android" in ua_lower:
            platform = "android"
        elif "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
            platform = "ios"
        elif "mozilla" in ua_lower or "chrome" in ua_lower or "safari" in ua_lower:
            platform = "web"
        else:
            platform = "unknown"

    return {
        "request_id": request_id,
        "client_ip": client_ip or "unknown",
        "platform": platform,
        "user_agent": user_agent or "unknown",
        "endpoint": request.url.path,
    }


def is_valid_guest_id(guest_id: str) -> bool:
    """Validate that guest ID starts with `guest|` followed by a valid RFC4122 v4 UUID."""
    if not guest_id.startswith(IDENTITY_PREFIX_GUEST):
        return False
    raw_uuid = guest_id[len(IDENTITY_PREFIX_GUEST):]
    return bool(_uuid_v4_regex.match(raw_uuid))


async def resolve_identity(request: Request) -> str:
    """
    FastAPI dependency for resolving authenticated user or guest identity.

    Usage in routers:
        @router.get("/preferences")
        async def get_preferences(user_id: str = Depends(resolve_identity)):
            ...
    """
    ctx = extract_request_context(request)

    # Architectural Hooks for Future Scaling & Abuse Protection:
    # TODO: Rate limit requests per guest identity / IP to mitigate identity spam
    # TODO: Implement identity expiration / TTL for inactive guest records
    # TODO: Abuse protection (proof-of-work challenge or captcha) on guest creation

    # 1. Check Authorization Header (Auth0 JWT)
    auth_header = request.headers.get(HEADER_AUTHORIZATION) or request.headers.get("authorization")
    if auth_header:
        parts = auth_header.strip().split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(
                f"Identity resolution failed: malformed Authorization scheme "
                f"request_id={ctx['request_id']} endpoint={ctx['endpoint']} client_ip={ctx['client_ip']}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header format. Expected 'Bearer <token>'",
            )

        token = parts[1].strip()
        # Verify JWT against Auth0 public keys (RS256)
        claims = verify_auth0_token(token)
        raw_sub = claims["sub"]
        user_id = normalize_auth0_user_id(raw_sub)

        logger.info(
            f"Identity resolved request_id={ctx['request_id']} user_id={user_id} "
            f"type=auth0 platform={ctx['platform']} endpoint={ctx['endpoint']} client_ip={ctx['client_ip']}"
        )
        return user_id

    # 2. Check X-Guest-ID Header
    guest_id = request.headers.get(HEADER_GUEST_ID) or request.headers.get(HEADER_GUEST_ID.lower())
    if guest_id:
        guest_id = guest_id.strip()
        if not is_valid_guest_id(guest_id):
            logger.warning(
                f"Identity rejected: invalid guest ID format "
                f"request_id={ctx['request_id']} endpoint={ctx['endpoint']} client_ip={ctx['client_ip']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid guest identity format. Expected 'guest|<uuid-v4>'",
            )

        logger.info(
            f"Identity resolved request_id={ctx['request_id']} user_id={guest_id} "
            f"type=guest platform={ctx['platform']} endpoint={ctx['endpoint']} client_ip={ctx['client_ip']}"
        )
        return guest_id

    # 3. Missing Both Identity Headers
    logger.warning(
        f"Identity resolution failed: missing identity headers "
        f"request_id={ctx['request_id']} endpoint={ctx['endpoint']} client_ip={ctx['client_ip']}"
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing user identity: provide Authorization or X-Guest-ID header",
    )


# Alias for direct invocation if needed
get_user_identity = resolve_identity
