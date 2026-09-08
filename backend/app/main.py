"""
Main FastAPI application module.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import config
from app.routers import conditions, routes, preferences, find_routes, heat_zones, profile

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
app.include_router(profile.router)


@app.get("/health")
async def health_check():
    """
    Health check endpoint exposing database, cache, postgis, and operational metrics status.
    """
    from app.services.cache import get_cache
    from app.services.postgis_shade import get_pool
    from app.services.metrics import metrics

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
        "metrics": {
            "cache_hit_rate": metrics.cache_hit_rate,
            "weather_provider_failures_total": metrics.weather_provider_failures_total,
            "aqi_provider_failures_total": metrics.aqi_provider_failures_total,
            "shade_provider_failures_total": metrics.shade_provider_failures_total,
        },
    }


@app.get("/metrics")
async def get_metrics():
    """
    Operational metrics endpoint exposing provider failures, cache hit rate, and latency summaries.
    """
    from app.services.metrics import metrics
    return metrics.get_metrics()
