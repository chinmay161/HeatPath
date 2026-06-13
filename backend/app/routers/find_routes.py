"""
Router for finding and scoring candidate routes.
"""
from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.schemas import RouteRequest, ScoredRoutesResponse, ScoredRoute, ConditionsSummary, Location
from app.services.ors_client import fetch_candidate_routes, simplify_path
from app.services.weather import get_weather, get_aqi, compute_heat_index
from app.services.osm_shade import shade_for_path
from app.services.comfort_scorer import score_route as calculate_route_scores

router = APIRouter(prefix="/find-routes", tags=["Routes"])

@router.post("/", response_model=ScoredRoutesResponse)
async def find_routes(request: RouteRequest) -> ScoredRoutesResponse:
    """
    Find and score multiple candidate pedestrian routes between start and end coordinates.
    """
    # 1. Fetch candidate routes from ORS
    candidate_paths = await fetch_candidate_routes(
        start_lat=request.start.lat,
        start_lon=request.start.lon,
        end_lat=request.end.lat,
        end_lon=request.end.lon,
        n=request.n_routes
    )
    
    # 2. Get live conditions for the start coordinate
    try:
        weather = await get_weather(request.start.lat, request.start.lon)
        raw_aqi = await get_aqi(request.start.lat, request.start.lon)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"External API error fetching weather/AQI conditions: {e}"
        )
        
    heat_index = compute_heat_index(weather["temperature_c"], weather["humidity_pct"])
    aqi_normalised = min(raw_aqi / 300.0, 1.0)
    
    scored_routes_list = []
    
    # 3. For each candidate path, simplify and score
    for path in candidate_paths:
        simplified_path = simplify_path(path, max_points=20)
        
        # Get shade percentages for each segment
        shade_percentages = await shade_for_path(simplified_path)
        
        # Build segments list for the comfort scorer
        # Load real user preferences from /preferences store
        from app.routers.preferences import _user_preferences

        segments = []
        for shade_pct in shade_percentages:
            segments.append({
                "shade_pct": shade_pct,
                "heat_index": heat_index,
                "aqi": aqi_normalised,
                "heat_sensitivity": _user_preferences["heat_sensitivity"],
                "aqi_sensitivity":  _user_preferences["aqi_sensitivity"],
            })
        # Calculate scores
        scores = calculate_route_scores(segments)
        
        scored_routes_list.append({
            "overall_score": scores["overall_score"],
            "shade_safety_score": scores["shade_safety_score"],
            "heat_safety_score": scores["heat_safety_score"],
            "path": [Location(lat=pt["lat"], lon=pt["lon"]) for pt in path],
            "segment_count": len(segments)
        })
        
    # 4. Sort scored routes by overall_score descending (best first)
    scored_routes_list.sort(key=lambda x: x["overall_score"], reverse=True)
    
    # Construct Ranked ScoredRoute objects
    routes_response_list = []
    for rank, route_data in enumerate(scored_routes_list, start=1):
        routes_response_list.append(ScoredRoute(
            rank=rank,
            overall_score=route_data["overall_score"],
            shade_safety_score=route_data["shade_safety_score"],
            heat_safety_score=route_data["heat_safety_score"],
            path=route_data["path"],
            segment_count=route_data["segment_count"]
        ))
        
    conditions_summary = ConditionsSummary(
        heat_index=heat_index,
        aqi_normalised=aqi_normalised,
        fetched_at_lat=request.start.lat,
        fetched_at_lon=request.start.lon
    )
    
    return ScoredRoutesResponse(
        routes=routes_response_list,
        conditions=conditions_summary
    )
