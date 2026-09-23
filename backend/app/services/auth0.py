"""
Auth0 JWT Verification Service

Validates incoming Auth0 access tokens using public JWKS keys.
Enforces RS256 signature verification, token expiration, audience, and issuer validation.
Extracts and normalizes the subject (sub) claim to `auth0|<sub>`.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
import jwt
from jwt import PyJWKClient, PyJWTError, ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError

from app.config import config
from app.constants.identity import IDENTITY_PREFIX_AUTH0

logger = logging.getLogger(__name__)

# Cached JWKS client instance
_jwks_client: Optional[PyJWKClient] = None
_jwks_url: Optional[str] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """Retrieve or initialize the PyJWKClient using configured Auth0 domain."""
    global _jwks_client, _jwks_url
    if not config.AUTH0_DOMAIN:
        return None

    expected_url = f"https://{config.AUTH0_DOMAIN}/.well-known/jwks.json"
    if _jwks_client is None or _jwks_url != expected_url:
        _jwks_url = expected_url
        _jwks_client = PyJWKClient(_jwks_url, cache_keys=True, max_cached_keys=16)
    return _jwks_client


def set_jwks_client(client: Optional[PyJWKClient]) -> None:
    """Explicitly inject a PyJWKClient instance (used for hermetic integration testing)."""
    global _jwks_client
    _jwks_client = client


def verify_auth0_token(token: str, public_key_override: Optional[Any] = None) -> Dict[str, Any]:
    """
    Verify an Auth0 JWT access token.

    Validates:
    - Signature against Auth0 JWKS public key
    - Expiration (exp)
    - Audience (aud) against AUTH0_AUDIENCE (if configured)
    - Issuer (iss) against AUTH0_ISSUER or https://{AUTH0_DOMAIN}/ (if configured)
    - Algorithm (RS256)

    Returns the verified claims payload.
    Raises HTTPException(401) on any failure.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed authorization token",
        )

    # 1. Resolve signing key
    signing_key: Any = None
    if public_key_override:
        signing_key = public_key_override
    else:
        jwks_client = get_jwks_client()
        if not jwks_client:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Auth0 authentication is not configured on the server",
            )
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token).key
        except Exception as e:
            logger.warning(f"[auth0] Failed to resolve signing key from JWKS: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token header or signing key not found in JWKS",
            )

    # 2. Decode and verify signature + claims
    try:
        expected_issuer = config.AUTH0_ISSUER or (f"https://{config.AUTH0_DOMAIN}/" if config.AUTH0_DOMAIN else None)
        expected_audience = config.AUTH0_AUDIENCE if config.AUTH0_AUDIENCE else None

        decode_kwargs: Dict[str, Any] = {
            "algorithms": config.AUTH0_ALGORITHMS,
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": bool(expected_audience),
                "verify_iss": bool(expected_issuer),
            },
        }

        if expected_audience:
            decode_kwargs["audience"] = expected_audience
        if expected_issuer:
            decode_kwargs["issuer"] = expected_issuer

        payload = jwt.decode(token, signing_key, **decode_kwargs)

        sub = payload.get("sub")
        if not sub or not isinstance(sub, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing required 'sub' claim",
            )

        return payload

    except ExpiredSignatureError:
        logger.info("[auth0] Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except InvalidAudienceError:
        logger.warning("[auth0] Token audience mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )
    except InvalidIssuerError:
        logger.warning("[auth0] Token issuer mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )
    except PyJWTError as e:
        logger.warning(f"[auth0] JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature or claims",
        )


def normalize_auth0_user_id(sub: str) -> str:
    """Normalize Auth0 sub claim to `auth0|<sub>`."""
    if sub.startswith(IDENTITY_PREFIX_AUTH0):
        return sub
    return f"{IDENTITY_PREFIX_AUTH0}{sub}"
