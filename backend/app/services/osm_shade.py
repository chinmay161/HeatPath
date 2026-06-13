import logging
import math
import httpx
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

async def fetch_shade_features(lat: float, lon: float, radius_m: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch shade-contributing features from Overpass API.
    """
    query = f"""
    [out:json];
    (
      node["natural"="tree"](around:{radius_m},{lat},{lon});
      nwr["landuse"="forest"](around:{radius_m},{lat},{lon});
      nwr["natural"="wood"](around:{radius_m},{lat},{lon});
      nwr["building"](around:{radius_m},{lat},{lon});
    );
    out center;
    """
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post("https://overpass-api.de/api/interpreter", data={"data": query})
            response.raise_for_status()
            data = response.json()
            return data.get("elements", [])
    except Exception as e:
        logger.warning(f"Overpass API error for ({lat}, {lon}): {e}")
        raise

def estimate_shade_percent(features: List[Dict[str, Any]], segment_length_m: float) -> float:
    """
    Estimate shade percentage based on Overpass features.
    """
    shade = 0.0
    for feature in features:
        tags = feature.get("tags", {})
        if tags.get("natural") == "tree":
            shade += 5.0
        elif "building" in tags:
            shade += 8.0
        elif tags.get("landuse") == "forest" or tags.get("natural") == "wood":
            shade += 10.0
            
    return min(shade, 95.0)

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

async def shade_for_path(path: List[Dict[str, float]]) -> List[float]:
    """
    Compute shade percentages for each segment of a path.
    """
    shade_percentages = []
    
    for i in range(len(path) - 1):
        p1 = path[i]
        p2 = path[i+1]
        
        mid_lat = (p1["lat"] + p2["lat"]) / 2.0
        mid_lon = (p1["lon"] + p2["lon"]) / 2.0
        
        segment_length_m = _haversine_distance(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        
        try:
            features = await fetch_shade_features(mid_lat, mid_lon, radius_m=50)
            shade = estimate_shade_percent(features, segment_length_m)
            shade_percentages.append(shade)
        except Exception:
            shade_percentages.append(0.0)
            
    return shade_percentages
