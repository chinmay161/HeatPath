"""
OpenRouteService client service for pedestrian routing.
"""
import logging
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
            "share_factor": 0.6,
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
        
    return paths[:n]


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
