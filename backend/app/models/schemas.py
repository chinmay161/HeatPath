"""
Pydantic schemas for request and response validation.
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import List


class Location(BaseModel):
    """A geographic coordinate."""
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    model_config = ConfigDict(from_attributes=True)


class ConditionsResponse(BaseModel):
    """Response schema for environmental conditions."""
    # Existing fields — unchanged (Dev A may reference these)
    heat_index:  float
    shade_index: float
    aqi_index:   float
    # Added fields — raw weather values + derived display helpers
    temperature_c: float  # real air temperature from Open-Meteo
    humidity_pct:  float  # relative humidity from Open-Meteo
    feels_like_c:  float  # Open-Meteo apparent temperature (accounts for wind/humidity)
    severity:      str    # SAFE / CAUTION / HIGH / EXTREME, derived from heat_index
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
    model_config = ConfigDict(from_attributes=True)


class PreferencesRequest(BaseModel):
    """Request schema for user preferences."""
    heat_sensitivity: int  = Field(default=5, ge=1, le=10, description="1 to 10")
    aqi_sensitivity:  int  = Field(default=5, ge=1, le=10, description="1 to 10")
    avoid_crowds:     bool = Field(default=False, description="Factor crowd density into route scoring")
    model_config = ConfigDict(from_attributes=True)


class PreferencesResponse(BaseModel):
    """Response schema for preference update."""
    status: str
    model_config = ConfigDict(from_attributes=True)


class RouteRequest(BaseModel):
    """Request schema for finding routes."""
    start:    Location = Field(..., description="Start coordinate")
    end:      Location = Field(..., description="End coordinate")
    n_routes: int      = Field(default=2, description="Number of candidate routes (max 2 for speed)")
    model_config = ConfigDict(from_attributes=True)


class ScoredRoute(BaseModel):
    """Schema for a scored route with details."""
    rank:                int            = Field(..., description="Score rank (1 = best)")
    overall_score:       float          = Field(..., description="Overall comfort score 0–1")
    shade_safety_score:  float          = Field(..., description="Shade safety score 0–1")
    heat_safety_score:   float          = Field(..., description="Heat safety score 0–1")
    crowd_safety_score:  float          = Field(..., description="Crowd safety score 0–1 (1 = uncrowded)")
    avg_shade_pct:       float          = Field(..., description="Average shade coverage across the route (0-100)")
    feels_like_c:        float          = Field(..., description="Estimated perceived temperature accounting for shade")
    shade_segments:      List[float]    = Field(..., description="Shade percentage per route segment")
    segment_distances_m: List[float]    = Field(..., description="Distance in meters per segment, aligned with shade_segments")
    path:                List[Location] = Field(..., description="Route coordinates")
    segment_count:       int            = Field(..., description="Number of path segments")
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
    routes:     List[ScoredRoute]  = Field(..., description="Ranked scored routes")
    conditions: ConditionsSummary  = Field(..., description="Environmental conditions summary")
    model_config = ConfigDict(from_attributes=True)


class HeatZonePoint(BaseModel):
    """A single grid point for the heat map gradient overlay."""
    lat: float
    lon: float
    comfort_score: float
    shade_pct: float
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
