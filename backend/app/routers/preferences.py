"""
Dev B owns this file.
POST /preferences — store user heat and AQI sensitivity settings.
Preferences are held in memory for now (Week 2: persist to DB or session).
"""
from fastapi import APIRouter
from app.models.schemas import PreferencesRequest, PreferencesResponse

router = APIRouter(prefix="/preferences", tags=["Preferences"])

# In-memory store — good enough for Week 1/2 demo
# Week 3: replace with Supabase or a session cookie
_user_preferences: dict = {
    "heat_sensitivity": 5,
    "aqi_sensitivity":  5,
}


@router.post("/", response_model=PreferencesResponse)
async def update_preferences(request: PreferencesRequest):
    """
    Update user routing preferences.
    heat_sensitivity and aqi_sensitivity are 1–10 integers.
    These weight the comfort scorer: higher = avoid heat/AQI more aggressively.
    """
    _user_preferences["heat_sensitivity"] = request.heat_sensitivity
    _user_preferences["aqi_sensitivity"]  = request.aqi_sensitivity
    return PreferencesResponse(status="success")


@router.get("/", response_model=PreferencesRequest)
async def get_preferences():
    """
    Return current preferences.
    Dev A's comfort_scorer calls this to get the user's sensitivity weights.
    """
    return PreferencesRequest(**_user_preferences)