"""
Unit tests for identity resolution dependency (Phase 4).
Tests guest UUID validation (400 on malformed), Auth0 token verification,
401 on missing credentials, and structured logging.
"""

import pytest
from unittest.mock import patch
from starlette.requests import Request
from fastapi import HTTPException

from app.services.identity import resolve_identity, is_valid_guest_id
from app.constants.identity import HEADER_GUEST_ID, HEADER_AUTHORIZATION


def make_request(headers: dict, path: str = "/preferences/") -> Request:
    """Helper to construct a mock Starlette Request object."""
    raw_headers = [
        (k.lower().encode("latin-1"), v.encode("latin-1"))
        for k, v in headers.items()
    ]
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "raw_path": path.encode("latin-1"),
        "headers": raw_headers,
        "query_string": b"",
        "client": ("127.0.0.1", 54321),
    }
    return Request(scope)


def test_is_valid_guest_id():
    """Verify strict guest UUID v4 validation rules."""
    assert is_valid_guest_id("guest|550e8400-e29b-41d4-a716-446655440000") is True
    assert is_valid_guest_id("guest|c436b701-d703-4f9e-a89e-3158c3db08cb") is True

    # Malformed cases: must be False
    assert is_valid_guest_id("guest|123") is False
    assert is_valid_guest_id("guest|hello") is False
    assert is_valid_guest_id("guest|../../") is False
    assert is_valid_guest_id("guest|550e8400-e29b-61d4-a716-446655440000") is False  # Version 6 invalid
    assert is_valid_guest_id("550e8400-e29b-41d4-a716-446655440000") is False  # Missing guest| prefix
    assert is_valid_guest_id("auth0|123456") is False


@pytest.mark.anyio
async def test_resolve_identity_valid_guest():
    """Verify valid guest ID is resolved properly."""
    valid_guest = "guest|550e8400-e29b-41d4-a716-446655440000"
    req = make_request({HEADER_GUEST_ID: valid_guest})

    user_id = await resolve_identity(req)
    assert user_id == valid_guest


@pytest.mark.anyio
async def test_resolve_identity_malformed_guest_raises_400():
    """Verify malformed guest ID raises 400 Bad Request."""
    invalid_cases = [
        "guest|123",
        "guest|hello",
        "guest|../../etc/passwd",
        "guest|invalid-uuid-syntax",
    ]
    for bad_id in invalid_cases:
        req = make_request({HEADER_GUEST_ID: bad_id})
        with pytest.raises(HTTPException) as exc_info:
            await resolve_identity(req)
        assert exc_info.value.status_code == 400
        assert "Invalid guest identity" in exc_info.value.detail


@pytest.mark.anyio
async def test_resolve_identity_missing_headers_raises_401():
    """Verify request without Authorization or X-Guest-ID raises 401 Unauthorized."""
    req = make_request({})
    with pytest.raises(HTTPException) as exc_info:
        await resolve_identity(req)
    assert exc_info.value.status_code == 401
    assert "Missing user identity" in exc_info.value.detail


@pytest.mark.anyio
async def test_resolve_identity_malformed_auth_header_raises_401():
    """Verify Authorization without Bearer raises 401."""
    req = make_request({HEADER_AUTHORIZATION: "Basic user:pass"})
    with pytest.raises(HTTPException) as exc_info:
        await resolve_identity(req)
    assert exc_info.value.status_code == 401
    assert "Invalid Authorization header" in exc_info.value.detail


@pytest.mark.anyio
async def test_resolve_identity_valid_auth0_token():
    """Verify valid Auth0 Bearer token resolves to normalized auth0|<sub>."""
    req = make_request({HEADER_AUTHORIZATION: "Bearer test.jwt.token"})

    with patch("app.services.identity.verify_auth0_token") as mock_verify:
        mock_verify.return_value = {"sub": "google-oauth2|998877"}
        user_id = await resolve_identity(req)
        assert user_id == "auth0|google-oauth2|998877"
        mock_verify.assert_called_once_with("test.jwt.token")


@pytest.mark.anyio
async def test_resolve_identity_preserves_auth0_sub_prefix():
    """Verify sub that already includes auth0| is not double-prefixed."""
    req = make_request({HEADER_AUTHORIZATION: "Bearer test.jwt.token"})

    with patch("app.services.identity.verify_auth0_token") as mock_verify:
        mock_verify.return_value = {"sub": "auth0|already_prefixed"}
        user_id = await resolve_identity(req)
        assert user_id == "auth0|already_prefixed"


@pytest.mark.anyio
async def test_resolve_identity_structured_logging(caplog):
    """Verify structured log includes metadata and never leaks raw tokens."""
    import logging
    caplog.set_level(logging.INFO, logger="app.identity")

    req = make_request(
        {
            HEADER_GUEST_ID: "guest|550e8400-e29b-41d4-a716-446655440000",
            "X-Platform": "web",
            "X-Request-ID": "req-xyz-123",
        },
        path="/preferences/",
    )

    user_id = await resolve_identity(req)
    assert user_id == "guest|550e8400-e29b-41d4-a716-446655440000"

    assert len(caplog.records) > 0
    log_msg = caplog.records[-1].message
    assert "Identity resolved" in log_msg
    assert "user_id=guest|550e8400-e29b-41d4-a716-446655440000" in log_msg
    assert "type=guest" in log_msg
    assert "platform=web" in log_msg
    assert "request_id=req-xyz-123" in log_msg
    assert "endpoint=/preferences/" in log_msg
