"""
Router for heat map gradient grid data.
"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.models.schemas import HeatZonesResponse
from app.services.comfort_scorer import score_segment
from app.services.osm_shade import fetch_shade_for_tile
from app.services.shade_tile_cache import get_tiles, store_tiles, tile_key
from app.services.solar import get_solar_position
from app.services.weather import compute_heat_index, get_aqi, get_weather

router = APIRouter(prefix="/heat-zones", tags=["Heat Zones"])
logger = logging.getLogger(__name__)

MIN_RESOLUTION = 8
MAX_RESOLUTION = 25
MAX_VIEWPORT_DEGREES = 0.5


def _clamp_resolution(resolution: int) -> int:
    """Clamp the requested grid resolution to the supported range."""
    return max(MIN_RESOLUTION, min(MAX_RESOLUTION, resolution))


def _validate_bounds(north: float, south: float, east: float, west: float) -> None:
    """Validate viewport bounds before doing expensive heat-zone work."""
    if north <= south or east <= west:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bounds: north must be greater than south and east must be greater than west",
        )

    if (north - south) >= MAX_VIEWPORT_DEGREES or (east - west) >= MAX_VIEWPORT_DEGREES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Viewport too large — zoom in for heat map data",
        )


def _generate_grid_points(
    north: float,
    south: float,
    east: float,
    west: float,
    resolution: int,
) -> list[tuple[float, float]]:
    """Generate an inclusive-edge grid for the visible map viewport."""
    lat_step = (north - south) / resolution
    lon_step = (east - west) / resolution
    return [
        (south + i * lat_step, west + j * lon_step)
        for i in range(resolution + 1)
        for j in range(resolution + 1)
    ]


async def _load_shade_tiles_for_grid(
    grid_points: list[tuple[float, float]],
) -> tuple[dict[str, dict], dict[tuple[float, float], str], set[str]]:
    """Load tile shade data for grid points with snap, dedupe, and batch fetch."""
    point_keys = {(lat, lon): tile_key(lat, lon) for lat, lon in grid_points}
    unique_keys = list(set(point_keys.values()))

    cached = await get_tiles(unique_keys)
    initially_cached_keys = set(cached.keys())
    missing_keys = [key for key in unique_keys if key not in cached]

    if missing_keys:
        results = await asyncio.gather(
            *[fetch_shade_for_tile(key) for key in missing_keys],
            return_exceptions=True,
        )
        fetched = {}
        for key, result in zip(missing_keys, results):
            if isinstance(result, Exception):
                logger.warning("[heat-zones] tile %s fetch failed: %s", key, result)
                fetched[key] = {"shade_pct": 25.0, "source": "fallback"}
            else:
                fetched[key] = result
        await store_tiles(fetched)
        cached.update(fetched)

    return cached, point_keys, initially_cached_keys


async def _load_center_conditions(north: float, south: float, east: float, west: float) -> tuple[float, float, dict]:
    """Fetch weather, AQI, and solar context once at the viewport center."""
    center_lat = (north + south) / 2
    center_lon = (east + west) / 2
    weather, raw_aqi = await asyncio.gather(
        get_weather(center_lat, center_lon),
        get_aqi(center_lat, center_lon),
    )
    solar = get_solar_position(center_lat, center_lon)
    heat_index = compute_heat_index(weather["temperature_c"], weather["humidity_pct"])
    return heat_index, float(raw_aqi), solar


def _solar_phase(solar: dict) -> str:
    """Map solar position to the phase string exposed to the frontend."""
    if solar.get("is_night"):
        return "night"
    if solar.get("elevation", 45.0) <= 10.0:
        return "golden_hour"
    return "day"


@router.get("/", response_model=HeatZonesResponse)
async def get_heat_zones(
    north: float = Query(..., description="Northern latitude of visible viewport"),
    south: float = Query(..., description="Southern latitude of visible viewport"),
    east: float = Query(..., description="Eastern longitude of visible viewport"),
    west: float = Query(..., description="Western longitude of visible viewport"),
    resolution: int = Query(15, description="Number of grid cells per side"),
) -> HeatZonesResponse:
    """Return a validated heat-zone grid for the visible map viewport."""
    _validate_bounds(north, south, east, west)
    clamped_resolution = _clamp_resolution(resolution)
    grid_points = _generate_grid_points(north, south, east, west, clamped_resolution)
    (shade_tiles, point_keys, initially_cached_keys), (heat_index, raw_aqi, solar) = await asyncio.gather(
        _load_shade_tiles_for_grid(grid_points),
        _load_center_conditions(north, south, east, west),
    )

    return HeatZonesResponse(
        grid=[
            {
                "lat": lat,
                "lon": lon,
                "comfort_score": score_segment(
                    shade_tiles[point_keys[(lat, lon)]]["shade_pct"],
                    heat_index,
                    raw_aqi,
                    5,
                    5,
                ),
                "shade_pct": shade_tiles[point_keys[(lat, lon)]]["shade_pct"],
                "source": (
                    "cached"
                    if point_keys[(lat, lon)] in initially_cached_keys
                    else shade_tiles[point_keys[(lat, lon)]].get("source", "fallback")
                ),
            }
            for lat, lon in grid_points
        ],
        resolution=clamped_resolution,
        bounds={"north": north, "south": south, "east": east, "west": west},
        conditions={"heat_index": heat_index, "aqi": raw_aqi, "solar_phase": _solar_phase(solar)},
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
