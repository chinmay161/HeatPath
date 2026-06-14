"""
Dev B owns this file.
POST /preferences — store user heat, AQI sensitivity, and crowd-avoidance settings.
Preferences are held in memory for now (Week 2: persist to DB or session).
"""
from fastapi import APIRouter
from app.models.schemas import PreferencesRequest, PreferencesResponse

router = APIRouter(prefix="/preferences", tags=["Preferences"])

# In-memory store — good enough for Week 1/2 demo
_user_preferences: dict = {
    "heat_sensitivity": 5,
    "aqi_sensitivity":  5,
    "avoid_crowds":     False,
}


@router.post("/", response_model=PreferencesResponse)
async def update_preferences(request: PreferencesRequest):
    """
    Update user routing preferences.
    heat_sensitivity / aqi_sensitivity are 1–10 integers.
    avoid_crowds toggles whether crowd density is factored into route scoring.
    """
    _user_preferences["heat_sensitivity"] = request.heat_sensitivity
    _user_preferences["aqi_sensitivity"]  = request.aqi_sensitivity
    _user_preferences["avoid_crowds"]     = request.avoid_crowds
    return PreferencesResponse(status="success")


@router.get("/", response_model=PreferencesRequest)
async def get_preferences():
    """
    Return current preferences.
    """
    return PreferencesRequest(**_user_preferences)