"""
GET /conditions — returns real-time heat index, humidity, AQI, and shade for a coordinate.
Returns structured unavailable state on third-party provider failure without fabricating data.
"""
from typing import Optional
from fastapi import APIRouter, Query
from app.models.schemas import ConditionsResponse
from app.services.weather import get_weather, get_aqi, compute_heat_index
from app.services.shade_tile_cache import tile_key, get_tiles

router = APIRouter(prefix="/conditions", tags=["Conditions"])


def _severity(heat_index: Optional[float]) -> Optional[str]:
    """Derive a display-safe severity label from the Steadman heat index."""
    if heat_index is None:
        return None
    if heat_index >= 41:
        return "EXTREME"
    if heat_index >= 35:
        return "HIGH"
    if heat_index >= 28:
        return "CAUTION"
    return "SAFE"


@router.get("/", response_model=ConditionsResponse)
async def get_conditions(
    lat: float = Query(..., description="Latitude", examples=[18.9220]),
    lon: float = Query(..., description="Longitude", examples=[72.8347]),
) -> ConditionsResponse:
    """
    Get environmental conditions for a location.
    Returns real-time heat index (°C), AQI index (0.0–1.0), and cached shade index if computed.
    When external providers are unreachable, returns 200 with structured status: "unavailable".
    """
    weather = await get_weather(lat, lon)
    aqi = await get_aqi(lat, lon)

    # If weather provider is unavailable, return structured unavailable state
    if weather.get("status") == "unavailable":
        return ConditionsResponse(
            status="unavailable",
            provider="open-meteo",
            provider_status=weather.get("provider_status", "unreachable"),
            retry_after=weather.get("retry_after", 60),
            observed_at=None,
            age_seconds=None,
            weather=None,
            aqi=aqi,
            heat_index=None,
            shade_index=None,
            aqi_index=None,
            temperature_c=None,
            humidity_pct=None,
            feels_like_c=None,
            severity=None,
        )

    heat_index = compute_heat_index(
        weather["temperature_c"],
        weather["humidity_pct"],
    )

    aqi_val = aqi.get("value") if isinstance(aqi, dict) else aqi
    aqi_index = round(min(aqi_val / 500.0, 1.0), 4) if aqi_val is not None else None

    # Check tile cache for known shade at this coordinate
    cached = await get_tiles([tile_key(lat, lon)])
    shade_index = None
    if tile_key(lat, lon) in cached:
        tile_shade = cached[tile_key(lat, lon)].get("shade_pct")
        if tile_shade is not None:
            shade_index = round(tile_shade / 100.0, 3)

    return ConditionsResponse(
        status="available",
        provider="open-meteo",
        provider_status=weather.get("provider_status", "healthy"),
        retry_after=None,
        observed_at=weather.get("observed_at"),
        age_seconds=weather.get("age_seconds", 0),
        heat_index=heat_index,
        shade_index=shade_index,
        aqi_index=aqi_index,
        temperature_c=weather["temperature_c"],
        humidity_pct=weather["humidity_pct"],
        feels_like_c=weather["feels_like_c"],
        severity=_severity(heat_index),
        weather=weather,
        aqi=aqi,
    )