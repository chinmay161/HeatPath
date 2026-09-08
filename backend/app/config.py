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

    # Comfort Scoring Weights & Normalization Thresholds
    # Source: NOAA National Weather Service Heat Index standard & EPA AQI Breakpoints
    SCORING_WEIGHT_SHADE = float(os.getenv("SCORING_WEIGHT_SHADE", "0.5"))
    SCORING_WEIGHT_HEAT = float(os.getenv("SCORING_WEIGHT_HEAT", "0.3"))
    SCORING_WEIGHT_AQI = float(os.getenv("SCORING_WEIGHT_AQI", "0.2"))
    SCORING_MAX_HEAT_INDEX = float(os.getenv("SCORING_MAX_HEAT_INDEX", "50.0"))  # °C extreme danger threshold
    SCORING_MAX_AQI = float(os.getenv("SCORING_MAX_AQI", "300.0"))  # Hazardous AQI upper bound

    # Microclimate & Urban Geometry Constants
    # Source: Steadman (1984) / Oke (1987) urban microclimate radiation reduction
    SHADE_COOLING_FACTOR_C = float(os.getenv("SHADE_COOLING_FACTOR_C", "7.0"))
    # Standard urban architecture floor-to-floor and building defaults (OSM urban modeling standard)
    DEFAULT_BUILDING_HEIGHT_M = float(os.getenv("DEFAULT_BUILDING_HEIGHT_M", "12.0"))
    LEVEL_HEIGHT_M = float(os.getenv("LEVEL_HEIGHT_M", "3.5"))
    # Algorithm Versioning & Integrity Gates
    SCORE_VERSION = os.getenv("SCORE_VERSION", "v1.3")
    SCORING_MIN_CONFIDENCE_THRESHOLD = float(os.getenv("SCORING_MIN_CONFIDENCE_THRESHOLD", "0.40"))

config = Config()
