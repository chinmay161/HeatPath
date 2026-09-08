"""
Router for hourly weather and pedestrian comfort forecast.
GET /forecast/hourly — returns 24-hour weather, apparent temp, UV, and comfort breakdown.
"""
from fastapi import APIRouter, Query, HTTPException, status
from app.models.schemas import HourlyForecastResponse
from app.services.weather import get_hourly_forecast

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.get("/hourly", response_model=HourlyForecastResponse)
async def get_hourly_weather_forecast(
    lat: float = Query(..., description="Latitude", examples=[18.9220]),
    lon: float = Query(..., description="Longitude", examples=[72.8347]),
) -> HourlyForecastResponse:
    """
    Get 24-hour hourly weather and pedestrian comfort score forecast.
    Combines live Open-Meteo predictions with comfort and UV risk evaluation.
    Returns structured unavailable state if external provider is unreachable.
    """
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid latitude or longitude coordinates",
        )

    result = await get_hourly_forecast(lat, lon)
    return HourlyForecastResponse(**result)
