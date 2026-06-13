"""
Main FastAPI application module.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import config
from app.routers import conditions, routes, preferences

app = FastAPI(title="HeatPath API", version="0.1.0")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conditions.router)
app.include_router(routes.router)
app.include_router(preferences.router)

@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {"status": "ok", "env": config.ENV}
