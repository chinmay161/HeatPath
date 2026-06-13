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
    heat_index: float
    shade_index: float
    aqi_index: float
    
    model_config = ConfigDict(from_attributes=True)

class RouteScoreRequest(BaseModel):
    """Request schema for scoring a route."""
    path: List[Location] = Field(..., description="Array of coordinates forming the route")
    
    model_config = ConfigDict(from_attributes=True)

class RouteScoreResponse(BaseModel):
    """Response schema for a scored route."""
    heat_safety_score: float
    shade_safety_score: float
    overall_score: float
    
    model_config = ConfigDict(from_attributes=True)

class PreferencesRequest(BaseModel):
    """Request schema for user preferences."""
    heat_sensitivity: int = Field(default=5, ge=1, le=10, description="1 to 10")
    aqi_sensitivity: int = Field(default=5, ge=1, le=10, description="1 to 10")
    
    model_config = ConfigDict(from_attributes=True)

class PreferencesResponse(BaseModel):
    """Response schema for preference update."""
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class RouteRequest(BaseModel):
    """Request schema for finding routes."""
    start: Location = Field(..., description="Start coordinate")
    end: Location = Field(..., description="End coordinate")
    n_routes: int = Field(default=3, description="Number of candidate routes to fetch and score")
    
    model_config = ConfigDict(from_attributes=True)

class ScoredRoute(BaseModel):
    """Schema for a scored route with details."""
    rank: int = Field(..., description="The score rank of this route (1 being best)")
    overall_score: float = Field(..., description="Overall comfort score (0.0 to 1.0)")
    shade_safety_score: float = Field(..., description="Shade safety score (0.0 to 1.0)")
    heat_safety_score: float = Field(..., description="Heat safety score (0.0 to 1.0)")
    path: List[Location] = Field(..., description="Simplified list of coordinates representing the path")
    segment_count: int = Field(..., description="Number of segments in the simplified path")
    
    model_config = ConfigDict(from_attributes=True)

class ConditionsSummary(BaseModel):
    """Schema summarizing the environmental conditions used for scoring."""
    heat_index: float = Field(..., description="Raw heat index in degrees C")
    aqi_normalised: float = Field(..., description="Normalised AQI (0.0 to 1.0)")
    fetched_at_lat: float = Field(..., description="Latitude where conditions were fetched")
    fetched_at_lon: float = Field(..., description="Longitude where conditions were fetched")
    
    model_config = ConfigDict(from_attributes=True)

class ScoredRoutesResponse(BaseModel):
    """Response schema for route search and scoring."""
    routes: List[ScoredRoute] = Field(..., description="Ranked list of scored routes")
    conditions: ConditionsSummary = Field(..., description="Fetched environmental conditions summary")
    
    model_config = ConfigDict(from_attributes=True)

