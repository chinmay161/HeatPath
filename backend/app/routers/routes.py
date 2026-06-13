"""
Routes router for scoring pedestrian paths.
"""
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import RouteScoreRequest, RouteScoreResponse
from app.services.osm_shade import shade_for_path

router = APIRouter(prefix="/score-route", tags=["Routes"])

@router.post("/", response_model=RouteScoreResponse)
async def score_route(request: RouteScoreRequest):
    """
    Score a route based on heat, shade, and AQI.
    
    TODO: heat_safety_score and overall_score are stubbed to 0.0 
    until the weather + AQI pipeline is completed by Dev B.
    """
    if len(request.path) < 2:
        return RouteScoreResponse(
            heat_safety_score=0.0,
            shade_safety_score=0.0,
            overall_score=0.0
        )
        
    path_dicts = [{"lat": loc.lat, "lon": loc.lon} for loc in request.path]
    shade_percentages = await shade_for_path(path_dicts)
    
    if not shade_percentages:
        avg_shade = 0.0
    else:
        avg_shade = sum(shade_percentages) / len(shade_percentages)
        
    # Normalise shade_safety_score to 0.0 - 1.0 (shade is capped at 95.0, but we can divide by 100)
    shade_safety_score = avg_shade / 100.0

    return RouteScoreResponse(
        heat_safety_score=0.0,
        shade_safety_score=shade_safety_score,
        overall_score=0.0
    )
