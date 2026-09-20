"""
Main FastAPI application module.
"""
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import config
from app.routers import conditions, routes, preferences, find_routes, heat_zones, profile, forecast, cool_spots

app = FastAPI(title="HeatPath API", version="0.1.0")

# CORS middleware configuration
base_origins = [
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:19006",
    "http://localhost:8000",
    "http://localhost:3000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8000",
]

configured_origins = [
    origin.strip()
    for origin in config.ALLOWED_ORIGINS.split(",")
    if origin.strip()
]

if "*" in configured_origins:
    cors_origins = ["*"]
    cors_origin_regex = None
    cors_credentials = False
else:
    cors_origins = list(dict.fromkeys(base_origins + configured_origins))
    cors_origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$"
    cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conditions.router)
app.include_router(routes.router)
app.include_router(preferences.router)
app.include_router(find_routes.router)
app.include_router(heat_zones.router)
app.include_router(profile.router)
app.include_router(forecast.router)
app.include_router(cool_spots.router)




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
        pool = await asyncio.wait_for(get_pool(), timeout=2.0)
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
