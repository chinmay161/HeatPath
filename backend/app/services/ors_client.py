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

async def fetch_candidate_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    n: int = 3
) -> List[List[Dict[str, float]]]:
    """
    Calls the ORS Directions API to get pedestrian routes.
    
    Args:
        start_lat: Latitude of the starting location.
        start_lon: Longitude of the starting location.
        end_lat: Latitude of the ending location.
        end_lon: Longitude of the ending location.
        n: The target number of routes to fetch.
        
    Returns:
        List[List[Dict[str, float]]]: List of candidate routes, where each route
                                     is a list of {'lat': float, 'lon': float} points.
    """
    # OpenRouteService uses [lon, lat] order — do NOT mix this up.
    url = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {getattr(config, 'ORS_API_KEY', '')}"
    }
    
    body = {
        "coordinates": [[start_lon, start_lat], [end_lon, end_lat]],
        "alternative_routes": {
            "share_factor": 0.4,
            "weight_factor": 1.6,
            "target_count": n
        },
        "geometry_simplify": False
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=body, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"OpenRouteService API error: Status {response.status_code}, Body: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouteService returned error status {response.status_code}: {response.text}"
                )
                
            data = response.json()
    except httpx.TimeoutException as e:
        logger.error(f"OpenRouteService request timeout: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouteService connection timed out after 15 seconds"
        )
    except httpx.RequestError as e:
        logger.error(f"OpenRouteService request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to OpenRouteService: {e}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error calling OpenRouteService: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected error communicating with routing service: {e}"
        )
        
    features = data.get("features", [])
    if not features:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No candidate routes found in the OpenRouteService response"
        )
        
    paths = []
    for idx, feature in enumerate(features):
        try:
            geometry = feature.get("geometry", {})
            coords = geometry.get("coordinates", [])
            if not coords:
                continue
            # Convert [lon, lat] coordinates to internal {"lat": lat, "lon": lon} format immediately.
            path = [{"lat": float(pt[1]), "lon": float(pt[0])} for pt in coords]
            paths.append(path)
        except (IndexError, TypeError, ValueError) as e:
            logger.error(f"Failed to parse route geometry coordinates at index {idx}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Malformed geometry in OpenRouteService route feature at index {idx}: {e}"
            )
            
    if not paths:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouteService returned features but no valid route geometry coordinates were found"
        )
        
    # Perform sequential deduplication: drop any route where > 80% of waypoints
    # are within 30m of another route's waypoints (simple pairwise lat/lon distance check).
    deduplicated_paths = []
    for idx, path in enumerate(paths):
        if not deduplicated_paths:
            deduplicated_paths.append(path)
            continue
            
        should_drop = False
        for accepted_path in deduplicated_paths:
            close_points = 0
            for pt1 in path:
                # Check if pt1 is within 30m of any waypoint in accepted_path
                for pt2 in accepted_path:
                    if haversine_distance(pt1["lat"], pt1["lon"], pt2["lat"], pt2["lon"]) <= 30.0:
                        close_points += 1
                        break
            
            overlap_ratio = close_points / len(path) if path else 0
            if overlap_ratio > 0.8:
                should_drop = True
                logger.warning(
                    f"Deduplication dropped candidate route at index {idx} "
                    f"due to {overlap_ratio * 100:.1f}% waypoint overlap (> 80%) with an accepted route"
                )
                break
                
        if not should_drop:
            deduplicated_paths.append(path)
            
    return deduplicated_paths[:n]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
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


def simplify_path(path: List[Dict[str, float]], max_points: int = 20) -> List[Dict[str, float]]:
    """
    Simplify a path using step downsampling to avoid overloading the Overpass API.
    Always includes the first and last point of the path.
    
    Args:
        path: List of geographic coordinates.
        max_points: Maximum number of points in the returned simplified path.
        
    Returns:
        List[Dict[str, float]]: Simplified path.
    """
    if len(path) <= max_points:
        return path
        
    step = len(path) // max_points
    # Slice using step, taking at most max_points - 1 elements, then append the last element.
    simplified = path[::step][:max_points - 1]
    
    # Ensure the exact last point of the path is appended
    if not simplified or simplified[-1] != path[-1]:
        simplified.append(path[-1])
        
    return simplified
