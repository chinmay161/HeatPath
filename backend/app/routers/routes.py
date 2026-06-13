from fastapi import APIRouter, HTTPException, status, Query
from app.models.schemas import RouteScoreRequest, RouteScoreResponse
from app.services.osm_shade import shade_for_path
from app.services.comfort_scorer import score_route as calculate_route_scores
from app.services.weather import get_weather, get_aqi, compute_heat_index

router = APIRouter(prefix="/score-route", tags=["Routes"])

@router.post("/", response_model=RouteScoreResponse)
async def score_route(
    request: RouteScoreRequest,
    heat_index: float = Query(0.0, description="Current heat index. Will be auto-fetched if 0.0."),
    aqi: float = Query(0.0, description="Current AQI. Will be auto-fetched if 0.0."),
    heat_sensitivity: int = Query(5, ge=1, le=10, description="User's heat sensitivity. Will come from preferences in Week 2."),
    aqi_sensitivity: int = Query(5, ge=1, le=10, description="User's AQI sensitivity. Will come from preferences in Week 2.")
):
    """
    Score a route based on heat, shade, and AQI.
    
    If heat_index and aqi are not supplied (remaining at their 0.0 defaults),
    this endpoint will automatically query the weather and AQI services using the starting
    coordinate of the path.
    """
    if len(request.path) < 2:
        return RouteScoreResponse(
            heat_safety_score=0.0,
            shade_safety_score=0.0,
            overall_score=0.0
        )
        
    # Auto-fetch live conditions if defaults are used
    if heat_index == 0.0 and aqi == 0.0:
        try:
            start_point = request.path[0]
            weather = await get_weather(start_point.lat, start_point.lon)
            raw_aqi = await get_aqi(start_point.lat, start_point.lon)
            heat_index = compute_heat_index(weather["temperature_c"], weather["humidity_pct"])
            aqi = min(raw_aqi / 300.0, 1.0)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to auto-fetch environmental conditions: {e}"
            )
        
    path_dicts = [{"lat": loc.lat, "lon": loc.lon} for loc in request.path]
    shade_percentages, sources = await shade_for_path(path_dicts)
    
    import statistics
    try:
        route_shade_source = statistics.mode(sources) if sources else "unknown"
    except Exception:
        route_shade_source = sources[0] if sources else "unknown"

    segments = []
    for shade_pct in shade_percentages:
        segments.append({
            "shade_pct": shade_pct,
            "heat_index": heat_index,
            "aqi": aqi,
            "heat_sensitivity": heat_sensitivity,
            "aqi_sensitivity": aqi_sensitivity
        })
        
    scores = calculate_route_scores(segments)

    return RouteScoreResponse(
        heat_safety_score=scores["heat_safety_score"],
        shade_safety_score=scores["shade_safety_score"],
        overall_score=scores["overall_score"],
        shade_source=route_shade_source
    )
