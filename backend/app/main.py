"""
Main FastAPI application module.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import config
from app.routers import conditions, routes, preferences, find_routes, heat_zones

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
app.include_router(find_routes.router)
app.include_router(heat_zones.router)

@app.get("/health")
async def health_check():
    """
    Health check endpoint exposing database, cache, and postgis status.
    """
    from app.services.cache import get_cache
    from app.services.postgis_shade import get_pool

    cache = await get_cache()
    cache_healthy = await cache.health_check()
    cache_backend_name = cache.name

    postgis_status = "healthy"
    try:
        pool = await get_pool()
        if pool is None:
            postgis_status = "unavailable"
    except Exception:
        postgis_status = "unhealthy"

    return {
        "status": "ok",
        "env": config.ENV,
        "database": "healthy" if postgis_status == "healthy" else "degraded",
        "cache": "healthy" if cache_healthy else "degraded",
        "cache_backend": cache_backend_name,
        "postgis": postgis_status,
        "shade_cache": {
            "backend": cache_backend_name,
            "status": "healthy" if cache_healthy else "degraded",
        },
    }
