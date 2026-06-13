"""
Routes router for scoring pedestrian paths.
"""
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/score-route", tags=["Routes"])

@router.post("/")
async def score_route():
    """
    Score a route based on heat, shade, and AQI.
    
    TODO: Implement path scoring algorithm.
    This endpoint will take an array of coordinates (a path) and return a heat/shade safety score,
    using the weather pipeline data to evaluate the comfort of the route.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="not implemented"
    )
