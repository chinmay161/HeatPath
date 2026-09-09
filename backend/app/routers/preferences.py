"""
Router for user routing and app preferences.
Persisted in PostgreSQL via user_store service.
"""
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import PreferencesRequest, PreferencesResponse
from app.services.user_store import (
    get_preferences as store_get_preferences,
    update_preferences as store_update_preferences,
    get_preferences_cached,
)

router = APIRouter(prefix="/preferences", tags=["Preferences"])

# Synchronized session cache for backwards compatibility with existing synchronous imports
_user_preferences: dict = get_preferences_cached()


async def _refresh_cache() -> dict:
    global _user_preferences
    _user_preferences = await store_get_preferences()
    return _user_preferences


@router.post("/", response_model=PreferencesResponse)
@router.post("", response_model=PreferencesResponse, include_in_schema=False)
async def update_user_preferences(request: PreferencesRequest):
    """
    Update user routing and application preferences.
    Persists to PostgreSQL database and synchronizes session cache.
    """
    # Validation
    if request.heat_sensitivity < 1 or request.heat_sensitivity > 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="heat_sensitivity must be between 1 and 10",
        )
    if request.aqi_sensitivity < 1 or request.aqi_sensitivity > 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="aqi_sensitivity must be between 1 and 10",
        )
    if request.walking_speed not in ("slow", "normal", "brisk"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="walking_speed must be 'slow', 'normal', or 'brisk'",
        )
    if request.accessibility not in ("none", "wheelchair", "flat_ground"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="accessibility must be 'none', 'wheelchair', or 'flat_ground'",
        )
    if request.units not in ("celsius", "fahrenheit"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="units must be 'celsius' or 'fahrenheit'",
        )
    if request.theme not in ("system", "light", "dark"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="theme must be 'system', 'light', or 'dark'",
        )

    fav_routes = [r.model_dump() for r in request.favorite_routes]
    updated = await store_update_preferences({
        "heat_sensitivity": request.heat_sensitivity,
        "aqi_sensitivity": request.aqi_sensitivity,
        "avoid_crowds": request.avoid_crowds,
        "walking_speed": request.walking_speed,
        "accessibility": request.accessibility,
        "units": request.units,
        "theme": request.theme,
        "favorite_routes": fav_routes,
    })
    await _refresh_cache()

    return PreferencesResponse(
        status="success",
        preferences=PreferencesRequest(**updated),
    )


@router.get("/", response_model=PreferencesRequest)
@router.get("", response_model=PreferencesRequest, include_in_schema=False)
async def get_user_preferences():
    """
    Return current user preferences from persistent store.
    """
    data = await _refresh_cache()
    return PreferencesRequest(**data)