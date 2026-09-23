"""
Unit tests for Auth0 JWT verification service (Phase 3).
Tests signature validation, expiration, audience/issuer checks, and claim normalization.
"""

import time
import pytest
from fastapi import HTTPException
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from app.services.auth0 import verify_auth0_token, normalize_auth0_user_id
from app.config import config


@pytest.fixture(scope="module")
def rsa_key_pair():
    """Generate an ephemeral RSA 2048 key pair for signing and verifying test JWTs."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key


def create_test_jwt(
    private_key,
    sub="usr_abc123",
    aud=None,
    iss=None,
    exp_offset=3600,
):
    """Helper to mint a signed RS256 test JWT."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "iat": now,
        "exp": now + exp_offset,
    }
    if aud:
        payload["aud"] = aud
    if iss:
        payload["iss"] = iss

    return jwt.encode(payload, private_key, algorithm="RS256")


def test_verify_auth0_token_valid(rsa_key_pair):
    """Verify that a properly signed RS256 token resolves successfully."""
    private_key, public_key = rsa_key_pair
    token = create_test_jwt(private_key, sub="auth0|valid_user_99")

    claims = verify_auth0_token(token, public_key_override=public_key)
    assert claims["sub"] == "auth0|valid_user_99"


def test_normalize_auth0_user_id():
    """Verify sub claims are normalized with auth0| prefix."""
    assert normalize_auth0_user_id("auth0|12345") == "auth0|12345"
    assert normalize_auth0_user_id("google-oauth2|12345") == "auth0|google-oauth2|12345"
    assert normalize_auth0_user_id("simple_user") == "auth0|simple_user"


def test_verify_auth0_token_expired(rsa_key_pair):
    """Verify expired token raises 401 Unauthorized."""
    private_key, public_key = rsa_key_pair
    token = create_test_jwt(private_key, exp_offset=-60)  # Expired 1 min ago

    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token(token, public_key_override=public_key)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_verify_auth0_token_invalid_signature(rsa_key_pair):
    """Verify token signed by different key is rejected with 401."""
    _, public_key = rsa_key_pair
    different_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = create_test_jwt(different_private_key, sub="intruder")

    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token(token, public_key_override=public_key)
    assert exc_info.value.status_code == 401
    assert "signature" in exc_info.value.detail.lower()


def test_verify_auth0_token_audience_mismatch(rsa_key_pair, monkeypatch):
    """Verify audience validation rejects mismatched audience."""
    monkeypatch.setattr(config, "AUTH0_AUDIENCE", "https://api.heatpath.com")
    private_key, public_key = rsa_key_pair
    token = create_test_jwt(private_key, aud="https://wrong-audience.com")

    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token(token, public_key_override=public_key)
    assert exc_info.value.status_code == 401
    assert "audience" in exc_info.value.detail.lower()


def test_verify_auth0_token_issuer_mismatch(rsa_key_pair, monkeypatch):
    """Verify issuer validation rejects mismatched issuer."""
    monkeypatch.setattr(config, "AUTH0_ISSUER", "https://heatpath.auth0.com/")
    private_key, public_key = rsa_key_pair
    token = create_test_jwt(private_key, iss="https://rogue-issuer.com/")

    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token(token, public_key_override=public_key)
    assert exc_info.value.status_code == 401
    assert "issuer" in exc_info.value.detail.lower()


def test_verify_auth0_token_missing_sub(rsa_key_pair):
    """Verify token without sub claim raises 401."""
    private_key, public_key = rsa_key_pair
    now = int(time.time())
    payload = {"iat": now, "exp": now + 3600}
    token = jwt.encode(payload, private_key, algorithm="RS256")

    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token(token, public_key_override=public_key)
    assert exc_info.value.status_code == 401
    assert "sub" in exc_info.value.detail.lower()


def test_verify_auth0_token_malformed():
    """Verify unparseable string raises 401."""
    with pytest.raises(HTTPException) as exc_info:
        verify_auth0_token("not-a-valid-jwt-token")
    assert exc_info.value.status_code == 401
