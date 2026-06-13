"""
OpenRouteService client service for pedestrian routing.
"""
import logging
import math
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException, status
from app.config import config

logger = logging.getLogger(__name__)

# ── In-memory route cache ──────────────────────────────────────────────────────
# Key: (start_lat, start_lon, end_lat, end_lon, n) rounded to 4 decimal places
# Value: list of paths
_route_cache: dict = {}

def _cache_key(start_lat, start_lon, end_lat, end_lon, n):
    return (
        round(start_lat, 4), round(start_lon, 4),
        round(end_lat,   4), round(end_lon,   4),
        n,
    )


async def fetch_candidate_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    n: int = 2
) -> List[List[Dict[str, float]]]:
    """
    Calls the ORS Directions API to get pedestrian routes.
    Results are cached in memory — repeat searches return instantly.
    """
    key = _cache_key(start_lat, start_lon, end_lat, end_lon, n)
    if key in _route_cache:
        logger.info(f"Route cache HIT for {key}")
        return _route_cache[key]

    url = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {getattr(config, 'ORS_API_KEY', '')}"
    }

    body = {
        "coordinates": [[start_lon, start_lat], [end_lon, end_lat]],
        "alternative_routes": {
            "share_factor":  0.4,
            "weight_factor": 1.6,
            "target_count":  n,
        },
        "geometry_simplify": False,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(url, json=body, headers=headers)

            if response.status_code != 200:
                logger.error(f"ORS error: {response.status_code} {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouteService returned {response.status_code}: {response.text}",
                )

            data = response.json()

    except httpx.TimeoutException as e:
        logger.error(f"ORS timeout: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouteService timed out. Please try again.",
        )
    except httpx.RequestError as e:
        logger.error(f"ORS request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to OpenRouteService: {e}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ORS unexpected error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected routing error: {e}",
        )

    features = data.get("features", [])
    if not features:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No routes found in ORS response.",
        )

    paths = []
    for idx, feature in enumerate(features):
        try:
            coords = feature.get("geometry", {}).get("coordinates", [])
            if not coords:
                continue
            path = [{"lat": float(pt[1]), "lon": float(pt[0])} for pt in coords]
            paths.append(path)
        except (IndexError, TypeError, ValueError) as e:
            logger.error(f"Failed to parse ORS route at index {idx}: {e}")
            continue

    if not paths:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ORS returned no valid route geometry.",
        )

    # Fast deduplication — O(n) per route using a set of sampled waypoints
    deduplicated = []
    for path in paths:
        if not deduplicated:
            deduplicated.append(path)
            continue

        # Sample every 5th point for speed
        sample = path[::5] or path[:1]
        is_dup = False
        for accepted in deduplicated:
            accepted_sample = accepted[::5] or accepted[:1]
            close = sum(
                1 for pt1 in sample
                if any(
                    haversine_distance(pt1["lat"], pt1["lon"], pt2["lat"], pt2["lon"]) <= 30
                    for pt2 in accepted_sample
                )
            )
            if close / len(sample) > 0.8:
                logger.warning("Deduplication dropped a duplicate route")
                is_dup = True
                break

        if not is_dup:
            deduplicated.append(path)

    result = deduplicated[:n]

    # Cache the result
    _route_cache[key] = result
    logger.info(f"Route cache SET for {key} — {len(result)} routes cached")

    return result


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def simplify_path(path: List[Dict[str, float]], max_points: int = 8) -> List[Dict[str, float]]:
    """
    Simplify a path by downsampling. Always keeps first and last point.
    """
    if len(path) <= max_points:
        return path
    step = len(path) // max_points
    simplified = path[::step][:max_points - 1]
    if not simplified or simplified[-1] != path[-1]:
        simplified.append(path[-1])
    return simplified