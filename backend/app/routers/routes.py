from fastapi import APIRouter, HTTPException, status, Query
from app.models.schemas import RouteScoreRequest, RouteScoreResponse
from app.services.osm_shade import shade_for_path
from app.services.comfort_scorer import score_route as calculate_route_scores

router = APIRouter(prefix="/score-route", tags=["Routes"])

@router.post("/", response_model=RouteScoreResponse)
async def score_route(
    request: RouteScoreRequest,
    heat_index: float = Query(0.0, description="Current heat index. Will come from /conditions in Week 2."),
    aqi: float = Query(0.0, description="Current AQI. Will come from /conditions in Week 2."),
    heat_sensitivity: int = Query(5, ge=1, le=10, description="User's heat sensitivity. Will come from preferences in Week 2."),
    aqi_sensitivity: int = Query(5, ge=1, le=10, description="User's AQI sensitivity. Will come from preferences in Week 2.")
):
    """
    Score a route based on heat, shade, and AQI.
    
    # TODO Week 2: replace heat_index + aqi defaults with a call to
    # GET /conditions using the path's start lat/lon (Dev B's endpoint)
    # TODO Week 2: replace sensitivity defaults with stored user preferences
    # (POST /preferences, Dev B's endpoint)
    """
    if len(request.path) < 2:
        return RouteScoreResponse(
            heat_safety_score=0.0,
            shade_safety_score=0.0,
            overall_score=0.0
        )
        
    path_dicts = [{"lat": loc.lat, "lon": loc.lon} for loc in request.path]
    shade_percentages = await shade_for_path(path_dicts)
    
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
        overall_score=scores["overall_score"]
    )
