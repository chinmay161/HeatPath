"""
Dev B owns this file.
Crowd density estimation for route segments.

Uses a deterministic, coordinate-based fallback (same pattern as osm_shade.py)
since Overpass POI density queries are blocked on this network.
Produces a stable "crowd %" (0-100) per segment based on lat/lon + segment
index — same coordinates always produce the same value.
"""
import hashlib


def _fallback_crowd(lat: float, lon: float, index: int) -> float:
    """
    Deterministic crowd percentage (0-100) based on coordinates and segment index.
    """
    key = f"{round(lat, 4)}:{round(lon, 4)}:{index}:crowd"
    digest = hashlib.md5(key.encode()).hexdigest()
    raw = int(digest[:8], 16) / 0xFFFFFFFF
    return round(raw * 100, 1)


async def crowd_for_path(path: list) -> list:
    """
    Returns a list of crowd percentages (0-100), one per segment,
    given a simplified path of {"lat": .., "lon": ..} points.
    """
    crowd_percentages = []
    for i in range(len(path) - 1):
        mid_lat = (path[i]["lat"] + path[i + 1]["lat"]) / 2
        mid_lon = (path[i]["lon"] + path[i + 1]["lon"]) / 2
        crowd_percentages.append(_fallback_crowd(mid_lat, mid_lon, i))
    return crowd_percentages