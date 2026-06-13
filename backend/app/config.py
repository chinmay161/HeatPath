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

config = Config()
