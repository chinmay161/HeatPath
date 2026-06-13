"""
Conditions router for weather, shade, and AQI data.
"""
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/conditions", tags=["Conditions"])

@router.get("/")
async def get_conditions():
    """
    Get environmental conditions (weather, shade, AQI) for a specific location.
    
    TODO: Integrate with Dev B's Weather+AQI pipeline.
    This will take location coordinates and return the current heat, shade, and AQI indices.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="not implemented"
    )
