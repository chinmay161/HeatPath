"""
Dev B owns this file.
Fetches real-time temperature, humidity, heat index from Open-Meteo (free, no key).
Fetches AQI from WAQI API (free token).
Called by GET /conditions endpoint.
"""
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")


async def get_weather(lat: float, lon: float) -> dict:
    """
    Returns temperature_c, humidity_pct, feels_like_c from Open-Meteo.
    Retries once on 429 rate limit.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature"
        f"&forecast_days=1"
    )
    import asyncio
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            if r.status_code == 429:
                await asyncio.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            data = r.json()
            current = data["current"]
            return {
                "temperature_c": current["temperature_2m"],
                "humidity_pct":  current["relative_humidity_2m"],
                "feels_like_c":  current["apparent_temperature"],
            }
    # All retries failed — realistic Mumbai summer fallback
    return {"temperature_c": 34.0, "humidity_pct": 65, "feels_like_c": 36.5}


async def get_aqi(lat: float, lon: float) -> int:
    """
    Returns AQI (0–500 scale) from Open-Meteo Air Quality API.
    Falls back to 50 (Good) if the API fails.
    """
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            if "current" in data and "us_aqi" in data["current"]:
                return int(data["current"]["us_aqi"])
    except Exception:
        pass
    return 50


def compute_heat_index(temp_c: float, humidity_pct: float) -> float:
    """
    Steadman heat index formula (°C).
    Accurate above 27°C and 40% humidity — the Indian summer range.
    """
    T = temp_c
    R = humidity_pct

    if T < 27:
        return round(T, 2)

    HI = (
        -8.78469475556
        + 1.61139411    * T
        + 2.33854883889 * R
        - 0.14611605    * T * R
        - 0.012308094   * T**2
        - 0.016424828   * R**2
        + 0.002211732   * T**2 * R
        + 0.00072546    * T   * R**2
        - 0.000003582   * T**2 * R**2
    )
    return round(HI, 2)