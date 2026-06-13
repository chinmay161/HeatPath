"""
Conditions router for weather, shade, and AQI data.
"""
from fastapi import APIRouter, HTTPException, status, Query
from app.models.schemas import ConditionsResponse

router = APIRouter(prefix="/conditions", tags=["Conditions"])

@router.get("/", response_model=ConditionsResponse)
async def get_conditions(lat: float = Query(..., description="Latitude"), lon: float = Query(..., description="Longitude")):
    """
    Get environmental conditions (weather, shade, AQI) for a specific location.
    
    TODO: Integrate with Dev B's Weather+AQI pipeline.
    This will take location coordinates and return the current heat, shade, and AQI indices.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="not implemented"
    )
