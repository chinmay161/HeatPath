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
