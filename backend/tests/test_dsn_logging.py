"""
Connection strings must never reach the logs: only host and database name may be logged.
"""
import logging

import asyncpg
import pytest

import app.services.postgis_shade as postgis_shade
import app.services.user_store as user_store
from app.config import config

FAKE_DSN = "postgresql://secret_user:s3cr3t-pa55@db.example.com:5432/shade_db?sslmode=require"


def test_describe_dsn_keeps_only_host_and_database():
    described = postgis_shade.describe_dsn(FAKE_DSN)
    assert "db.example.com" in described
    assert "shade_db" in described
    assert "secret_user" not in described
    assert "s3cr3t-pa55" not in described


def test_describe_dsn_handles_garbage():
    described = postgis_shade.describe_dsn("not a dsn")
    assert "not a dsn" not in described


def test_describe_dsn_never_echoes_keyword_style_dsn():
    described = postgis_shade.describe_dsn("host=db.example.com user=secret_user password=s3cr3t-pa55")
    assert "secret_user" not in described
    assert "s3cr3t-pa55" not in described


@pytest.fixture
def fake_pool(monkeypatch):
    """Configure a DSN with credentials and stub out the real connection."""
    monkeypatch.setattr(config, "POSTGIS_DSN", FAKE_DSN)
    monkeypatch.setattr(postgis_shade, "_pool", None)
    monkeypatch.setattr(user_store, "_db_pool", None)

    class DummyPool:
        async def close(self):
            pass

    async def _create_pool(*args, **kwargs):
        return DummyPool()
    monkeypatch.setattr(asyncpg, "create_pool", _create_pool)


def _assert_no_credentials(caplog):
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "db.example.com" in text
    assert "secret_user" not in text
    assert "s3cr3t-pa55" not in text
    assert FAKE_DSN not in text


@pytest.mark.asyncio
async def test_postgis_pool_log_omits_credentials(fake_pool, caplog):
    with caplog.at_level(logging.INFO, logger="app.services.postgis_shade"):
        await postgis_shade.get_pool()
    _assert_no_credentials(caplog)


@pytest.mark.asyncio
async def test_user_store_pool_log_omits_credentials(fake_pool, caplog):
    with caplog.at_level(logging.INFO, logger="app.services.user_store"):
        await user_store.get_db_pool()
    _assert_no_credentials(caplog)
