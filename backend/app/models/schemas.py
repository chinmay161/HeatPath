"""
Pydantic schemas for request and response validation.
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any, Union


class Location(BaseModel):
    """A geographic coordinate."""
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    model_config = ConfigDict(from_attributes=True)


class ConfidenceReport(BaseModel):
    """Detailed confidence breakdown for route scoring."""
    value: float = Field(..., description="Confidence score 0.0 to 1.0")
    missing_inputs: List[str] = Field(default_factory=list, description="List of completely unavailable inputs")
    degraded_inputs: List[str] = Field(default_factory=list, description="List of fallback/low-fidelity inputs")
    computed_from: List[str] = Field(default_factory=list, description="List of verified inputs successfully used in calculation")
    model_config = ConfigDict(from_attributes=True)


class ConditionsResponse(BaseModel):
    """Response schema for environmental conditions."""
    status: str = "available"  # "available" | "unavailable"
    provider: Optional[str] = "open-meteo"
    provider_status: Optional[str] = Field(default="healthy", description="'healthy' | 'timeout' | 'rate_limited' | 'unreachable' | 'http_error'")
    retry_after: Optional[int] = Field(default=None, description="Seconds to wait before retrying request")
    observed_at: Optional[str] = Field(default=None, description="ISO timestamp of weather observation")
    age_seconds: Optional[int] = Field(default=None, description="Age of data in seconds")
    heat_index: Optional[float] = None
    shade_index: Optional[float] = None
    aqi_index: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    feels_like_c: Optional[float] = None
    severity: Optional[str] = None
    weather: Optional[dict] = None
    aqi: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)


class RouteScoreRequest(BaseModel):
    """Request schema for scoring a route."""
    path: List[Location] = Field(..., description="Array of coordinates forming the route")
    model_config = ConfigDict(from_attributes=True)


class RouteScoreResponse(BaseModel):
    """Response schema for a scored route."""
    heat_safety_score:  float
    shade_safety_score: float
    overall_score:      float
    shade_source:       str = "unknown"
    score_version:      str = "v1.3"
    confidence:         Optional[Union[ConfidenceReport, float]] = None
    model_config = ConfigDict(from_attributes=True)


class FavoriteRouteItem(BaseModel):
    """Schema for a bookmarked favorite route."""
    id: str = Field(..., description="Unique route identifier")
    name: str = Field(..., description="Route name or label")
    start_lat: float = Field(..., description="Starting latitude")
    start_lon: float = Field(..., description="Starting longitude")
    end_lat: float = Field(..., description="Ending latitude")
    end_lon: float = Field(..., description="Ending longitude")
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PreferencesRequest(BaseModel):
    """Request schema for user preferences."""
    heat_sensitivity: int = Field(default=5, ge=1, le=10, description="1 to 10 scale")
    aqi_sensitivity:  int = Field(default=5, ge=1, le=10, description="1 to 10 scale")
    avoid_crowds:     bool = Field(default=False, description="Factor crowd density into route scoring")
    walking_speed:    str = Field(default="normal", description="'slow' | 'normal' | 'brisk'")
    accessibility:    str = Field(default="none", description="'none' | 'wheelchair' | 'flat_ground'")
    units:            str = Field(default="celsius", description="'celsius' | 'fahrenheit'")
    theme:            str = Field(default="system", description="'system' | 'light' | 'dark'")
    favorite_routes:  List[FavoriteRouteItem] = Field(default_factory=list, description="Saved favorite routes")
    model_config = ConfigDict(from_attributes=True)


class PreferencesResponse(BaseModel):
    """Response schema for preference update."""
    status: str
    preferences: Optional[PreferencesRequest] = None
    model_config = ConfigDict(from_attributes=True)



class RouteRequest(BaseModel):
    """Request schema for finding routes."""
    start:    Location = Field(..., description="Start coordinate")
    end:      Location = Field(..., description="End coordinate")
    n_routes: int      = Field(default=2, description="Number of candidate routes (max 2 for speed)")
    model_config = ConfigDict(from_attributes=True)


class ScoredRoute(BaseModel):
    """Schema for a scored route with details."""
    rank:                int                    = Field(..., description="Score rank (1 = best)")
    score_version:       str                    = Field(default="v1.3", description="Algorithm version used for comfort scoring")
    overall_score:       Optional[float]        = Field(default=None, description="Overall comfort score 0–1 (None if confidence is below threshold)")
    confidence:          Union[ConfidenceReport, float] = Field(default=1.0, description="Confidence report or score 0.0–1.0 based on data completeness")
    missing_inputs:      List[str]              = Field(default_factory=list, description="List of unavailable environmental inputs")
    shade_safety_score:  float                  = Field(..., description="Shade safety score 0–1")
    heat_safety_score:   float                  = Field(..., description="Heat safety score 0–1")
    crowd_safety_score:  Optional[float]        = Field(default=None, description="Crowd safety score (None: feature disabled)")
    avg_shade_pct:       float                  = Field(..., description="Average shade coverage across the route (0-100)")
    feels_like_c:        float                  = Field(..., description="Estimated perceived temperature accounting for shade")
    shade_segments:      List[Optional[float]]  = Field(..., description="Shade percentage per route segment")
    shade_sources:       List[str]              = Field(default_factory=list, description="Shade data source per segment ('overpass' | 'street_type' | 'cached' | 'night')")
    segment_distances_m: List[float]            = Field(..., description="Distance in meters per segment, aligned with shade_segments")
    path:                List[Location]         = Field(..., description="Route coordinates")
    segment_count:       int                    = Field(..., description="Number of path segments")
    model_config = ConfigDict(from_attributes=True)


class ConditionsSummary(BaseModel):
    """Environmental conditions used for scoring."""
    heat_index:      float = Field(..., description="Heat index °C")
    aqi_normalised:  float = Field(..., description="Normalised AQI 0–1")
    fetched_at_lat:  float = Field(..., description="Latitude where conditions fetched")
    fetched_at_lon:  float = Field(..., description="Longitude where conditions fetched")
    model_config = ConfigDict(from_attributes=True)


class ScoredRoutesResponse(BaseModel):
    """Response for route search and scoring."""
    score_version: str                = Field(default="v1.3", description="Algorithm version used for comfort scoring")
    routes:        List[ScoredRoute]  = Field(..., description="Ranked scored routes")
    conditions:    ConditionsSummary  = Field(..., description="Environmental conditions summary")
    model_config = ConfigDict(from_attributes=True)


class HeatZonePoint(BaseModel):
    """A single grid point for the heat map gradient overlay."""
    lat: float
    lon: float
    comfort_score: float
    shade_pct: Optional[float] = None
    source: str
    model_config = ConfigDict(from_attributes=True)


class HeatZonesResponse(BaseModel):
    """Response schema for heat-zone grid data."""
    grid: list[HeatZonePoint]
    resolution: int
    bounds: dict[str, float]
    conditions: dict
    generated_at: str
    model_config = ConfigDict(from_attributes=True)


class UserProfile(BaseModel):
    """User profile model."""
    name: str = Field(..., min_length=1, max_length=60, description="User's display name")
    email: Optional[str] = Field(default=None, max_length=120, description="Optional contact email")
    bio: Optional[str] = Field(default=None, max_length=200, description="Brief user bio or walking note")
    avatar_id: str = Field(default="tree", description="Selected avatar identifier")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    """Request model for updating user profile."""
    name: str = Field(..., min_length=1, max_length=60, description="User's display name")
    email: Optional[str] = Field(default=None, max_length=120, description="Optional contact email")
    bio: Optional[str] = Field(default=None, max_length=200, description="Brief user bio or walking note")
    avatar_id: Optional[str] = Field(default="tree", description="Selected avatar identifier")
    model_config = ConfigDict(from_attributes=True)


class HourlyForecastItem(BaseModel):
    """Hourly forecast slice for comfort tracking."""
    time: str = Field(..., description="ISO hourly timestamp")
    temperature_c: float = Field(..., description="Air temperature in Celsius")
    humidity_pct: float = Field(..., description="Relative humidity percentage")
    feels_like_c: float = Field(..., description="Apparent temperature in Celsius")
    uv_index: float = Field(default=0.0, description="UV index")
    precipitation_probability: float = Field(default=0.0, description="Precipitation chance %")
    wind_speed_kmh: float = Field(default=0.0, description="Wind speed in km/h")
    comfort_score: float = Field(..., description="Comfort score 0.0 to 1.0")
    severity: str = Field(..., description="'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME'")
    is_best_time: bool = Field(default=False, description="Flagged as optimal walking window")
    model_config = ConfigDict(from_attributes=True)


class HourlyForecastResponse(BaseModel):
    """Response schema for hourly weather & comfort forecast."""
    status: str = Field(default="available", description="'available' | 'unavailable'")
    provider: str = Field(default="open-meteo")
    provider_status: str = Field(default="healthy")
    observed_at: Optional[str] = None
    retry_after: Optional[int] = None
    hours: List[HourlyForecastItem] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


