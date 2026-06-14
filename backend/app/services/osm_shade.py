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

async def estimate_shade_from_street_type(lat: float, lon: float, solar_elevation: float = None) -> tuple[float, str]:
    """
    Estimate shade percentage based on street/land-use tags at coordinate.
    
    This performs a separate lightweight Overpass API query.
    """
    if solar_elevation is not None and solar_elevation < 0:
        return (0.0, "night")
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

    for el in elements:
        tags = el.get("tags", {})
        if tags.get("bridge") == "yes":
            return 40.0, "street_type"

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
      way["bridge"="yes"]["highway"](around:{radius_m},{lat},{lon});
      way["bridge"="yes"]["railway"](around:{radius_m},{lat},{lon});
      way["covered"="yes"](around:{radius_m},{lat},{lon});
      way["building"="roof"](around:{radius_m},{lat},{lon});
      node["amenity"="shelter"]["shelter_type"="public_transport"](around:{radius_m},{lat},{lon});
    );
    out tags geom;
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


def extract_building_height(element: dict) -> float:
    """
    Extract building height from elements tags using priority:
    1. height
    2. building:levels
    3. levels
    Default is 12.0m. Handle non-numeric / malformed values gracefully.
    """
    tags = element.get("tags", {}) if element else {}
    if not tags:
        return 12.0

    # Priority 1: height
    if "height" in tags:
        val = tags["height"]
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            val_clean = val.strip().lower()
            if val_clean.endswith("m"):
                val_clean = val_clean[:-1].strip()
            try:
                return float(val_clean)
            except ValueError:
                pass

    # Priority 2: building:levels
    if "building:levels" in tags:
        val = tags["building:levels"]
        try:
            return float(int(float(val)) * 3.5)
        except (ValueError, TypeError):
            pass

    # Priority 3: levels
    if "levels" in tags:
        val = tags["levels"]
        try:
            return float(int(float(val)) * 3.5)
        except (ValueError, TypeError):
            pass

    return 12.0


def estimate_shade_percent(
    features: List[Dict[str, Any]],
    solar_elevation: float,
    solar_azimuth: float,
    segment_length_m: float = 250,
) -> float:
    """
    Estimate shade percentage with physical geometry and sun angle.
    """
    if solar_elevation < 0:
        return 0.0

    shade = 0.0
    for feature in features:
        tags = feature.get("tags", {})
        if not tags:
            continue

        # Structural shade rules:
        if tags.get("bridge") == "yes" and "highway" in tags:
            shade += 25.0
        elif tags.get("bridge") == "yes" and "railway" in tags:
            shade += 20.0
        elif tags.get("covered") == "yes":
            shade += 18.0
        elif tags.get("building") == "roof":
            shade += 22.0
        elif tags.get("shelter_type") == "public_transport":
            shade += 10.0
        elif tags.get("amenity") == "shelter":
            shade += 8.0
        # Trees:
        elif tags.get("natural") == "tree":
            shade += 12.0
        # Forest / Wood:
        elif tags.get("landuse") == "forest" or tags.get("natural") == "wood":
            shade += 25.0
        # Buildings:
        elif "building" in tags:
            height = extract_building_height(feature)
            elevation_rad = math.radians(solar_elevation)
            if elevation_rad <= 0:
                shadow_length = 0.0
            else:
                shadow_length = height / math.tan(elevation_rad)

            if shadow_length >= segment_length_m:
                contrib = 30.0
            elif shadow_length >= segment_length_m * 0.5:
                contrib = 20.0
            elif shadow_length >= 20.0:
                contrib = 12.0
            elif shadow_length >= 7.0:
                contrib = 6.0
            else:
                contrib = 2.0
            shade += contrib

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
    tile_lat, tile_lon = float(parts[0]), float(parts[1])

    from app.services.solar import get_solar_position

    solar = get_solar_position(tile_lat, tile_lon)

    if solar["is_night"]:
        return {
            "shade_pct": 0.0,
            "source": "night",
            "solar_elevation": solar["elevation"],
            "solar_multiplier": 1.0
        }

    features, source = await fetch_shade_features(tile_lat, tile_lon, radius_m=60)

    if source == "overpass" and features:
        shade = estimate_shade_percent(
            features,
            solar_elevation=solar["elevation"],
            solar_azimuth=solar["azimuth"],
            segment_length_m=250
        )
        data_source = "overpass"
    else:
        shade, src = await estimate_shade_from_street_type(tile_lat, tile_lon, solar["elevation"])
        data_source = "fallback" if source == "failed" else src

    return {
        "shade_pct": round(shade, 2),
        "source": data_source,
        "solar_elevation": round(solar["elevation"], 1),
        "solar_multiplier": 1.0
    }

async def shade_for_path(path: List[Dict[str, float]]) -> dict:
    """
    Compute shade percentages for each segment of a path using SQLite tile cache batching.
    """
    # Step 1 — guard:
    if len(path) < 2:
        return {
            "shade_values": [],
            "solar_elevation": 45.0,
            "solar_multiplier": 1.0,
            "shade_sources": []
        }

    # Calculate solar context for the path using starting point
    from app.services.solar import get_current_elevation
    start_pt = path[0]
    solar_elevation = get_current_elevation(start_pt["lat"], start_pt["lon"])
    solar_multiplier = 1.0

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
                
    return {
        "shade_values": shade_percentages,
        "solar_elevation": round(solar_elevation, 1),
        "solar_multiplier": solar_multiplier,
        "shade_sources": sources
    }