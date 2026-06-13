"""
Main FastAPI application module.
"""
from fastapi import FastAPI
from app.config import config

app = FastAPI(title="HeatPath API", version="0.1.0")

@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "ok", "env": config.ENV}
