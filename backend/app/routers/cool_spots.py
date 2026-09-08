"""
Router for Cool Spots discovery.
GET /cool-spots — find nearby parks, air-conditioned public refuges, and drinking water points.
"""
import asyncio
import logging
import math
import time
from typing import Optional, List, Dict, Any
import httpx
from fastapi import APIRouter, Query, HTTPException, status
from app.models.schemas import CoolSpotsResponse, CoolSpotItem
from app.services.metrics import metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cool-spots", tags=["Cool Spots"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE_TTL_SECONDS = 900  # 15 minutes
_cool_spots_cache: Dict[str, Dict[str, Any]] = {}


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _classify(tags: Dict[str, str]) -> Optional[Dict[str, str]]:
    leisure = tags.get("leisure", "")
    shop = tags.get("shop", "")
    amenity = tags.get("amenity", "")

    if leisure == "park":
        return {"category": "park", "icon": "shade", "tone": "green", "badge": "DEEP SHADE"}
    if shop in ("mall", "department_store") or amenity in ("cinema", "library"):
        return {"category": "ac", "icon": "ac", "tone": "blue", "badge": "A/C REFUGE"}
    if amenity in ("drinking_water", "water_point", "fountain"):
        return {"category": "water", "icon": "water", "tone": "blue", "badge": "WATER"}
    return None


def _resolve_name(tags: Dict[str, str]) -> Optional[str]:
    name = tags.get("name") or tags.get("name:en")
    if name:
        return name
    amenity = tags.get("amenity", "")
    if amenity == "drinking_water":
        return "Drinking Water"
    if amenity == "water_point":
        return "Water Point"
    if amenity == "fountain":
        return "Public Fountain"
    return None


@router.get("", response_model=CoolSpotsResponse, include_in_schema=False)
@router.get("/", response_model=CoolSpotsResponse)
async def get_cool_spots(
    lat: float = Query(..., description="Latitude", examples=[18.9220]),
    lon: float = Query(..., description="Longitude", examples=[72.8347]),
    radius_m: int = Query(1500, ge=100, le=5000, description="Search radius in meters"),
    category: Optional[str] = Query(None, description="Optional category filter: 'park' | 'ac' | 'water'"),
) -> CoolSpotsResponse:
    """
    Find nearby pedestrian cool refuges within radius_m meters.
    Returns categorized parks, air-conditioned public spaces, and water points.
    """
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid coordinates",
        )

    # Check 15-minute response cache
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}_{radius_m}"
    now = time.time()
    cached = _cool_spots_cache.get(cache_key)
    if cached and (now - cached["timestamp"]) < CACHE_TTL_SECONDS:
        all_spots = cached["spots"]
        filtered = [s for s in all_spots if not category or s.category == category]
        return CoolSpotsResponse(
            status="available",
            provider="overpass-cached",
            count=len(filtered),
            radius_m=radius_m,
            spots=filtered,
        )

    start_time = time.perf_counter()

    query = (
        f"[out:json][timeout:10];"
        f"("
        f"node['leisure'='park'](around:{radius_m},{lat},{lon});"
        f"way['leisure'='park'](around:{radius_m},{lat},{lon});"
        f"node['shop'~'mall|department_store'](around:{radius_m},{lat},{lon});"
        f"way['shop'~'mall|department_store'](around:{radius_m},{lat},{lon});"
        f"node['amenity'~'cinema|library'](around:{radius_m},{lat},{lon});"
        f"way['amenity'~'cinema|library'](around:{radius_m},{lat},{lon});"
        f"node['amenity'~'drinking_water|water_point|fountain'](around:{radius_m},{lat},{lon});"
        f");"
        f"out center;"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            data = r.json()
            elements = data.get("elements", [])
            duration_ms = (time.perf_counter() - start_time) * 1000
            metrics.record_provider_call("overpass_coolspots", duration_ms, success=True)
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        metrics.record_provider_call("overpass_coolspots", duration_ms, success=False, failure_type="error")
        logger.warning("[cool_spots] Overpass query failed: %s", e)
        # If external provider fails, return structured response
        return CoolSpotsResponse(
            status="unavailable",
            provider="overpass",
            count=0,
            radius_m=radius_m,
            spots=[],
        )

    seen_names = set()
    spots: List[CoolSpotItem] = []

    for el in elements:
        tags = el.get("tags", {})
        cls = _classify(tags)
        if not cls:
            continue
        name = _resolve_name(tags)
        if not name:
            continue

        norm_name = name.strip().lower()
        if norm_name in seen_names:
            continue
        seen_names.add(norm_name)

        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lon = el.get("lon") or el.get("center", {}).get("lon")
        if el_lat is None or el_lon is None:
            continue

        dist_m = round(_haversine_m(lat, lon, el_lat, el_lon))
        walk_min = max(1, round(dist_m / 80.0))  # standard ~4.8 km/h pedestrian walking pace

        spots.append(CoolSpotItem(
            id=f"{el.get('type', 'node')}/{el.get('id', 0)}",
            name=name,
            lat=float(el_lat),
            lon=float(el_lon),
            distance_m=dist_m,
            walk_min=walk_min,
            category=cls["category"],
            icon=cls["icon"],
            tone=cls["tone"],
            badge=cls["badge"],
        ))

    spots.sort(key=lambda s: s.distance_m)

    # Cache unfiltered results
    _cool_spots_cache[cache_key] = {
        "timestamp": now,
        "spots": spots,
    }

    filtered = [s for s in spots if not category or s.category == category]

    return CoolSpotsResponse(
        status="available",
        provider="overpass",
        count=len(filtered),
        radius_m=radius_m,
        spots=filtered,
    )
