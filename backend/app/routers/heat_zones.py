"""
Router for heat map gradient grid data.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from app.models.schemas import HeatZonesResponse

router = APIRouter(prefix="/heat-zones", tags=["Heat Zones"])

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

    return HeatZonesResponse(
        grid=[
            {
                "lat": lat,
                "lon": lon,
                "comfort_score": 0.0,
                "shade_pct": 0.0,
                "source": "pending",
            }
            for lat, lon in grid_points
        ],
        resolution=clamped_resolution,
        bounds={"north": north, "south": south, "east": east, "west": west},
        conditions={"heat_index": 0.0, "aqi": 0.0, "solar_phase": "day"},
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
