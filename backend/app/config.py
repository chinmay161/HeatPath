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
    # No default: when unset, PostGIS and the user database are disabled (fallbacks only).
    POSTGIS_DSN = os.getenv("POSTGIS_DSN", "").strip()
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")

    # Redis Cache Configuration
    REDIS_URL = os.getenv("REDIS_URL", "")
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
    REDIS_DB = int(os.getenv("REDIS_DB", 0))
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 21600))  # 6 hours
    CACHE_NAMESPACE = os.getenv("CACHE_NAMESPACE", "heatpath")

    # Weather provider (Open-Meteo) caching per ~0.01 degree grid cell, and 429 protection
    WEATHER_CACHE_TTL_SECONDS = int(os.getenv("WEATHER_CACHE_TTL_SECONDS", "600"))  # current weather + AQI
    FORECAST_CACHE_TTL_SECONDS = int(os.getenv("FORECAST_CACHE_TTL_SECONDS", "1800"))
    # How long a cached value may still be served, marked stale, when the provider fails
    WEATHER_STALE_MAX_SECONDS = int(os.getenv("WEATHER_STALE_MAX_SECONDS", "3600"))  # 1 hour
    FORECAST_STALE_MAX_SECONDS = int(os.getenv("FORECAST_STALE_MAX_SECONDS", "43200"))  # 12 hours
    PROVIDER_CACHE_MAX_ENTRIES = int(os.getenv("PROVIDER_CACHE_MAX_ENTRIES", "2000"))
    # Circuit breaker after a 429 when Open-Meteo sends no usable Retry-After
    OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS = int(os.getenv("OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS", "60"))
    OPEN_METEO_RATE_LIMIT_MAX_SECONDS = int(os.getenv("OPEN_METEO_RATE_LIMIT_MAX_SECONDS", "3600"))
    # Total time for one Open-Meteo call, all attempts and waits included. Must stay under
    # the app's 15 s per-attempt timeout so the server answers (stale or unavailable) first.
    OPEN_METEO_CALL_BUDGET_SECONDS = float(os.getenv("OPEN_METEO_CALL_BUDGET_SECONDS", "12"))
    OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS = float(os.getenv("OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS", "5"))
    OPEN_METEO_MAX_ATTEMPTS = int(os.getenv("OPEN_METEO_MAX_ATTEMPTS", "2"))  # 1 retry, never for a 429
    OPEN_METEO_RETRY_WAIT_SECONDS = float(os.getenv("OPEN_METEO_RETRY_WAIT_SECONDS", "1"))

    # Comfort Scoring Weights & Normalization Thresholds
    # Source: NOAA National Weather Service Heat Index standard & EPA AQI Breakpoints
    SCORING_WEIGHT_SHADE = float(os.getenv("SCORING_WEIGHT_SHADE", "0.5"))
    SCORING_WEIGHT_HEAT = float(os.getenv("SCORING_WEIGHT_HEAT", "0.3"))
    SCORING_WEIGHT_AQI = float(os.getenv("SCORING_WEIGHT_AQI", "0.2"))
    SCORING_MAX_HEAT_INDEX = float(os.getenv("SCORING_MAX_HEAT_INDEX", "50.0"))  # °C extreme danger threshold
    SCORING_MAX_AQI = float(os.getenv("SCORING_MAX_AQI", "300.0"))  # Hazardous AQI upper bound

    # Hourly forecast "best time to walk" is only picked between these local hours (inclusive)
    FORECAST_BEST_TIME_START_HOUR = int(os.getenv("FORECAST_BEST_TIME_START_HOUR", "6"))
    FORECAST_BEST_TIME_END_HOUR = int(os.getenv("FORECAST_BEST_TIME_END_HOUR", "21"))

    # Microclimate & Urban Geometry Constants
    # Source: Steadman (1984) / Oke (1987) urban microclimate radiation reduction
    SHADE_COOLING_FACTOR_C = float(os.getenv("SHADE_COOLING_FACTOR_C", "7.0"))
    # Standard urban architecture floor-to-floor and building defaults (OSM urban modeling standard)
    DEFAULT_BUILDING_HEIGHT_M = float(os.getenv("DEFAULT_BUILDING_HEIGHT_M", "12.0"))
    LEVEL_HEIGHT_M = float(os.getenv("LEVEL_HEIGHT_M", "3.5"))
    # Algorithm Versioning & Integrity Gates
    SCORE_VERSION = os.getenv("SCORE_VERSION", "v1.3")
    SCORING_MIN_CONFIDENCE_THRESHOLD = float(os.getenv("SCORING_MIN_CONFIDENCE_THRESHOLD", "0.40"))

    # Auth0 Authentication Configuration
    AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
    AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
    AUTH0_ISSUER = os.getenv("AUTH0_ISSUER", "")
    AUTH0_ALGORITHMS = [algo.strip() for algo in os.getenv("AUTH0_ALGORITHMS", "RS256").split(",") if algo.strip()]

config = Config()
