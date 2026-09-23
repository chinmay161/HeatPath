"""
Router for user routing and application preferences.

Scoped strictly by resolved user identity (guest|<uuid> or auth0|<sub>).
Endpoints never inspect request headers directly and do not distinguish between
guest and authenticated users; all resolution is encapsulated in the identity dependency.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import PreferencesRequest, PreferencesResponse
from app.services.identity import resolve_identity
from app.services.preferences_store import PreferencesStore, get_preferences_store

router = APIRouter(prefix="/preferences", tags=["Preferences"])


def _validate_preferences(request_data: PreferencesRequest) -> None:
    """Validate routing and application preference parameters."""
    if request_data.heat_sensitivity < 1 or request_data.heat_sensitivity > 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="heat_sensitivity must be between 1 and 10",
        )
    if request_data.aqi_sensitivity < 1 or request_data.aqi_sensitivity > 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="aqi_sensitivity must be between 1 and 10",
        )
    if request_data.walking_speed not in ("slow", "normal", "brisk"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="walking_speed must be 'slow', 'normal', or 'brisk'",
        )
    if request_data.accessibility not in ("none", "wheelchair", "flat_ground"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="accessibility must be 'none', 'wheelchair', or 'flat_ground'",
        )
    if request_data.units not in ("celsius", "fahrenheit"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="units must be 'celsius' or 'fahrenheit'",
        )
    if request_data.theme not in ("system", "light", "dark"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="theme must be 'system', 'light', or 'dark'",
        )


@router.put("/", response_model=PreferencesResponse)
@router.put("", response_model=PreferencesResponse, include_in_schema=False)
@router.post("/", response_model=PreferencesResponse)
@router.post("", response_model=PreferencesResponse, include_in_schema=False)
async def update_user_preferences(
    request_data: PreferencesRequest,
    user_id: str = Depends(resolve_identity),
    store: PreferencesStore = Depends(get_preferences_store),
):
    """
    Update preferences for the current resolved user.
    Preserves existing API contract (PUT & POST /preferences).
    """
    _validate_preferences(request_data)

    fav_routes = [r.model_dump() for r in request_data.favorite_routes]
    updates = {
        "heat_sensitivity": request_data.heat_sensitivity,
        "aqi_sensitivity": request_data.aqi_sensitivity,
        "avoid_crowds": request_data.avoid_crowds,
        "walking_speed": request_data.walking_speed,
        "accessibility": request_data.accessibility,
        "units": request_data.units,
        "theme": request_data.theme,
        "favorite_routes": fav_routes,
    }

    updated = await store.update(user_id, updates)

    return PreferencesResponse(
        status="success",
        preferences=PreferencesRequest(**updated),
    )


@router.get("/", response_model=PreferencesRequest)
@router.get("", response_model=PreferencesRequest, include_in_schema=False)
async def get_user_preferences(
    user_id: str = Depends(resolve_identity),
    store: PreferencesStore = Depends(get_preferences_store),
):
    """
    Return current isolated preferences for the resolved user.
    """
    data = await store.get(user_id)
    return PreferencesRequest(**data)