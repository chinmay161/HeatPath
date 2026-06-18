"""
Dev B owns this file.
GET /conditions — returns real heat index, humidity, AQI for a lat/lon.
"""
from fastapi import APIRouter, Query, HTTPException
from app.models.schemas import ConditionsResponse
from app.services.weather import get_weather, get_aqi, compute_heat_index

router = APIRouter(prefix="/conditions", tags=["Conditions"])


def _severity(heat_index: float) -> str:
    """Derive a display-safe severity label from the Steadman heat index."""
    if heat_index >= 41:
        return "EXTREME"
    if heat_index >= 35:
        return "HIGH"
    if heat_index >= 28:
        return "CAUTION"
    return "SAFE"


@router.get("/", response_model=ConditionsResponse)
async def get_conditions(
    lat: float = Query(..., description="Latitude",  examples=[18.9220]),
    lon: float = Query(..., description="Longitude", examples=[72.8347]),
):
    """
    Get environmental conditions for a location.
    Returns real-time heat index (°C), AQI index (0.0–1.0), and shade (Dev A fills shade_index).
    """
    try:
        weather = await get_weather(lat, lon)
        aqi     = await get_aqi(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"External API error: {e}")

    heat_index = compute_heat_index(
        weather["temperature_c"],
        weather["humidity_pct"],
    )
    aqi_index = round(min(aqi / 500.0, 1.0), 4)

    return ConditionsResponse(
        heat_index=heat_index,
        shade_index=0.0,                      # Dev A's OSM shade module populates this
        aqi_index=aqi_index,
        temperature_c=weather["temperature_c"],
        humidity_pct=weather["humidity_pct"],
        feels_like_c=weather["feels_like_c"],
        severity=_severity(heat_index),
    )