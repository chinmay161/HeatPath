"""
SQLite persistence service for user profile and preferences.
Database is stored in backend/data/user_store.db.
"""
import sqlite3
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "user_store.db")

DEFAULT_PROFILE = {
    "name": "Alex River",
    "email": "alex.river@example.com",
    "bio": "Urban walker seeking shady streets and cool breezes.",
    "avatar_id": "tree",
}

DEFAULT_PREFERENCES = {
    "heat_sensitivity": 5,
    "aqi_sensitivity": 5,
    "avoid_crowds": False,
    "walking_speed": "normal",
    "accessibility": "none",
    "units": "celsius",
    "theme": "system",
    "favorite_routes": [],
}


def _get_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables if they do not exist."""
    with _get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL,
                email TEXT,
                bio TEXT,
                avatar_id TEXT NOT NULL DEFAULT 'tree',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                heat_sensitivity INTEGER NOT NULL DEFAULT 5,
                aqi_sensitivity INTEGER NOT NULL DEFAULT 5,
                avoid_crowds INTEGER NOT NULL DEFAULT 0,
                walking_speed TEXT NOT NULL DEFAULT 'normal',
                accessibility TEXT NOT NULL DEFAULT 'none',
                units TEXT NOT NULL DEFAULT 'celsius',
                theme TEXT NOT NULL DEFAULT 'system',
                favorite_routes_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL
            );
        """)
        conn.commit()


def reset_db():
    """Reset database tables to default empty state (for tests)."""
    init_db()
    with _get_connection() as conn:
        conn.execute("DELETE FROM user_profile")
        conn.execute("DELETE FROM user_preferences")
        conn.commit()



def get_profile() -> Dict[str, Any]:
    """Retrieve user profile, initializing default if not found."""
    init_db()
    with _get_connection() as conn:
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        if row:
            return dict(row)
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute("""
            INSERT INTO user_profile (id, name, email, bio, avatar_id, created_at, updated_at)
            VALUES (1, :name, :email, :bio, :avatar_id, :now, :now)
        """, {
            "name": DEFAULT_PROFILE["name"],
            "email": DEFAULT_PROFILE["email"],
            "bio": DEFAULT_PROFILE["bio"],
            "avatar_id": DEFAULT_PROFILE["avatar_id"],
            "now": now_iso,
        })
        conn.commit()
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        return dict(row)


def update_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    """Update user profile."""
    init_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    current = get_profile()
    updated = {
        "name": data.get("name", current["name"]).strip(),
        "email": data.get("email", current.get("email")),
        "bio": data.get("bio", current.get("bio")),
        "avatar_id": data.get("avatar_id", current["avatar_id"]),
        "updated_at": now_iso,
    }
    with _get_connection() as conn:
        conn.execute("""
            UPDATE user_profile
            SET name = :name,
                email = :email,
                bio = :bio,
                avatar_id = :avatar_id,
                updated_at = :updated_at
            WHERE id = 1
        """, updated)
        conn.commit()
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
        return dict(row)
