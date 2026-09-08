"""
Configuration settings for the HeatPath API.
Loads environment variables from .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 8000))
    ENV = os.getenv("ENV", "development")
    API_KEY_PLACEHOLDER = os.getenv("API_KEY_PLACEHOLDER", "")
    ORS_API_KEY = os.getenv("ORS_API_KEY", "")
    POSTGIS_DSN = os.getenv("POSTGIS_DSN", "postgresql://heatpath_app:heatpath_secure_pass_2026@127.0.0.1:5433/heatpath_osm")

    # Redis Cache Configuration
    REDIS_URL = os.getenv("REDIS_URL", "")
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
    REDIS_DB = int(os.getenv("REDIS_DB", 0))
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 21600))  # 6 hours
    CACHE_NAMESPACE = os.getenv("CACHE_NAMESPACE", "heatpath")

config = Config()
