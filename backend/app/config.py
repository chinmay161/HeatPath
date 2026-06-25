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
    POSTGIS_DSN = os.getenv("POSTGIS_DSN", "postgresql://heatpath_app:heatpath_secure_pass_2026@localhost:5432/heatpath_osm")

config = Config()
