# Live Overpass Query Diagnostic Results (Mumbai segment midpoint lat=18.9347, lon=72.8353):
# a) Query with radius 50m (node["natural"="tree"], way["building"], way["landuse"="forest"], way["natural"="wood"]):
#    Status code: 200
#    Elements returned: 7
#    Element types: 7 ways
# b) Query with radius 100m (same filters):
#    Status code: 200
#    Elements returned: 27
#    Element types: 27 ways
#    Difference: 20 additional ways found with expanded radius.
# c) Full building query with radius 100m (way["building"], relation["building"]):
#    Status code: 200
#    Elements returned: 27
#    Element types: 27 ways
#    No relation-type buildings returned; all building features are ways.

# Tile caching is handled by shade_tile_cache.py (SQLite, 250m tiles, 30d TTL)
# Do NOT add module-level caching here — it has no TTL and leaks memory.

import logging
import math
import asyncio
import httpx
from typing import List, Dict, Any
from app.services.shade_tile_cache import tile_key, get_tiles, store_tiles

logger = logging.getLogger(__name__)

OVERPASS_HEADERS = {
    "User-Agent": "HeatPath/1.0 (heatpath-app@gmail.com)",
    "Accept": "application/json",
}

async def estimate_shade_from_street_type(lat: float, lon: float) -> tuple[float, str]:
    """
    Estimate shade percentage based on street/land-use tags at coordinate.
    
    This performs a separate lightweight Overpass API query.
    """
    query = f"""
    [out:json][timeout:8];
    (
      way["highway"](around:30,{lat},{lon});
      way["landuse"](around:80,{lat},{lon});
      way["leisure"="park"](around:80,{lat},{lon});
    );
    out tags;
    """
    headers = {
        "User-Agent": "HeatPath/1.0 (contact: support@heatpathapp.org)"
    }
    elements = []
    api_failed = False
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post("https://overpass-api.de/api/interpreter", data={"data": query}, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get("elements", [])
            else:
                logger.warning(f"Overpass street type API failed: status={resp.status_code}")
                api_failed = True
    except Exception as e:
        logger.warning(f"Overpass street type API failed: error={e}")
        api_failed = True

    if api_failed or not elements:
        return 25.0, "street_type"

    matched_scores = []
    for el in elements:
        tags = el.get("tags", {})
        
        # landuse rules
        landuse = tags.get("landuse")
        if landuse == "residential":
            matched_scores.append(20.0)
        elif landuse == "commercial":
            matched_scores.append(35.0)
        elif landuse == "retail":
            matched_scores.append(30.0)
        elif landuse == "industrial":
            matched_scores.append(10.0)
            
        # leisure rules
        if tags.get("leisure") == "park":
            matched_scores.append(55.0)
            
        # highway rules
        highway = tags.get("highway")
        if highway == "pedestrian":
            matched_scores.append(40.0)
        elif highway == "footway":
            matched_scores.append(15.0)
        elif highway in ("primary", "secondary"):
            matched_scores.append(30.0)
        elif highway == "residential":
            matched_scores.append(20.0)
        elif highway == "service":
            matched_scores.append(15.0)

    if not matched_scores:
        return 25.0, "street_type"

    return float(max(matched_scores)), "street_type"



async def fetch_shade_features(lat: float, lon: float, radius_m: int = 100) -> tuple[List[Dict[str, Any]], str]:
    query = f"""
    [out:json][timeout:15];
    (
      node["natural"="tree"](around:{radius_m},{lat},{lon});
      way["building"](around:{radius_m},{lat},{lon});
      relation["building"](around:{radius_m},{lat},{lon});
      way["landuse"="forest"](around:{radius_m},{lat},{lon});
      way["natural"="wood"](around:{radius_m},{lat},{lon});
      way["amenity"="shelter"](around:{radius_m},{lat},{lon});
    );
    out body;
    """
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=OVERPASS_HEADERS) as client:
            resp = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
            )
            if resp.status_code != 200:
                logger.warning(f"Overpass API failed: status={resp.status_code}, using fallback")
                return [], "failed"
            data = resp.json()
            return data.get("elements", []), "overpass"
    except Exception as e:
        # Try to extract status code if it's an HTTP exception
        status_code = getattr(getattr(e, "response", None), "status_code", None)
        if status_code is not None:
            logger.warning(f"Overpass API failed: status={status_code}, using fallback")
        else:
            logger.warning(f"Overpass API failed: error={e}, using fallback")
        return [], "failed"


def estimate_shade_percent(features: List[Dict[str, Any]], segment_length_m: float) -> float:
    shade = 0.0
    for feature in features:
        tags = feature.get("tags", {})
        if tags.get("natural") == "tree":
            shade += 5.0
        elif "building" in tags:
            shade += 8.0
        elif tags.get("landuse") == "forest" or tags.get("natural") == "wood":
            shade += 10.0
        elif tags.get("amenity") == "shelter":
            shade += 5.0
    return min(shade, 95.0)


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fallback_shade(lat: float, lon: float, index: int) -> float:
    """
    Realistic shade fallback when Overpass is unreachable.
    Uses coordinate hash + segment index to produce varied but
    deterministic shade values that differ between routes.
    Simulates real Indian urban shade patterns:
    - Some segments near buildings: 15–40% shade
    - Open roads: 5–15% shade
    - Tree-lined stretches: 30–60% shade
    """
    # Hash the coordinates to get a stable pseudo-random value
    seed = abs(hash(f"{lat:.4f}{lon:.4f}{index}")) % 100
    if seed < 20:
        return round(5 + (seed / 20) * 10, 1)   # Open road: 5–15%
    elif seed < 55:
        return round(15 + (seed / 55) * 25, 1)  # Buildings: 15–40%
    elif seed < 80:
        return round(30 + (seed / 80) * 30, 1)  # Tree-lined: 30–60%
    else:
        return round(10 + (seed / 100) * 15, 1) # Mixed: 10–25%


def midpoint(p1: Dict[str, float], p2: Dict[str, float]) -> Dict[str, float]:
    """Calculate the midpoint between two coordinates."""
    return {
        "lat": (p1["lat"] + p2["lat"]) / 2.0,
        "lon": (p1["lon"] + p2["lon"]) / 2.0
    }

async def fetch_shade_for_tile(tile_key_str: str) -> dict:
    """Fetch shade features for a specific tile key using a 60m query radius."""
    parts = tile_key_str.split("_")
    lat, lon = float(parts[0]), float(parts[1])
    features, source = await fetch_shade_features(lat, lon, radius_m=60)
    if source == "overpass" and features:
        shade = estimate_shade_percent(features, segment_length_m=250)
        return {"shade_pct": shade, "source": "overpass"}
    else:
        shade, src = await estimate_shade_from_street_type(lat, lon)
        db_src = "fallback" if source == "failed" else src
        return {"shade_pct": shade, "source": db_src}

async def shade_for_path(path: List[Dict[str, float]]) -> tuple[List[float], List[str]]:
    """
    Compute shade percentages for each segment of a path using SQLite tile cache batching.
    """
    # Step 1 — guard: if len(path) < 2: return [], []
    if len(path) < 2:
        return [], []

    # Step 2 — compute segment midpoints:
    midpoints = [midpoint(path[i], path[i+1]) for i in range(len(path)-1)]

    # Step 3 — snap ALL midpoints to tile keys:
    keys = [tile_key(m["lat"], m["lon"]) for m in midpoints]
    unique_keys = list(set(keys))

    # Step 4 — bulk SQLite lookup:
    cached = await get_tiles(unique_keys)
    initially_cached_keys = set(cached.keys())
    missing_keys = [k for k in unique_keys if k not in cached]

    # Step 5 — fetch missing tiles in parallel:
    if missing_keys:
        tasks = [fetch_shade_for_tile(k) for k in missing_keys]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        fetched = {}
        for key, result in zip(missing_keys, results):
            if isinstance(result, Exception):
                logger.warning(f"[shade] tile {key} fetch failed: {result}")
                fetched[key] = {"shade_pct": 25.0, "source": "fallback"}
            else:
                fetched[key] = result
        await store_tiles(fetched)
        cached.update(fetched)

    # Step 6 — assemble per-segment results:
    shade_percentages = [cached[keys[i]]["shade_pct"] for i in range(len(midpoints))]
    sources = []
    for k in keys:
        if k in initially_cached_keys:
            sources.append("cached")
        else:
            src = cached[k]["source"]
            if src == "fallback":
                sources.append("failed_fallback")
            else:
                sources.append(src)
                
    return shade_percentages, sources