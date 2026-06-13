"""
Preferences router for user settings.
"""
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import PreferencesRequest, PreferencesResponse

router = APIRouter(prefix="/preferences", tags=["Preferences"])

@router.post("/", response_model=PreferencesResponse)
async def update_preferences(request: PreferencesRequest):
    """
    Update user routing preferences.
    
    TODO: Implement user preferences storage.
    This will allow users to set their sensitivity to heat or bad AQI,
    which will weight the route scoring algorithm.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="not implemented"
    )
