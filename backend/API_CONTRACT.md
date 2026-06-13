# Week 1 API Contract Sync

This document defines the finalized API contract for Week 1, enabling Dev B to integrate the Weather and AQI data pipeline in Week 2.

## Endpoints

### 1. `GET /conditions`
- **Description**: Get environmental conditions for a specific location.
- **Query Params**:
  - `lat` (float): Latitude
  - `lon` (float): Longitude
- **Response Schema Model**: `ConditionsResponse`
- **Response Example** (200 OK):
  ```json
  {
    "heat_index": 35.5,
    "shade_index": 0.0,
    "aqi_index": 45.0
  }
  ```

### 2. `POST /preferences`
- **Description**: Update user routing preferences.
- **Request Schema Model**: `PreferencesRequest`
- **Request Example**:
  ```json
  {
    "heat_sensitivity": 7,
    "aqi_sensitivity": 5
  }
  ```
- **Response Schema Model**: `PreferencesResponse`
- **Response Example** (200 OK):
  ```json
  {
    "status": "success"
  }
  ```

### 3. `POST /score-route`
- **Description**: Score a pedestrian path based on heat, shade, and AQI.
- **Request Schema Model**: `RouteScoreRequest`
- **Query Parameters (Optional)**:
  - `heat_index` (float, default 0.0): Current heat index for the route.
  - `aqi` (float, default 0.0): Current AQI for the route.
  - `heat_sensitivity` (int, default 5): User's sensitivity to heat (1-10).
  - `aqi_sensitivity` (int, default 5): User's sensitivity to AQI (1-10).
  
  *How Dev B should call this in Week 2*: Once the pipeline is live, Dev B should fetch the `heat_index` and `aqi` from `GET /conditions` (using the start lat/lon of the path) and retrieve `heat_sensitivity` and `aqi_sensitivity` from the user's stored preferences. These should be passed as query parameters to this endpoint to calculate real dynamic route comfort scores.

- **Request Example**:
  ```json
  {
    "path": [
      {"lat": 40.7128, "lon": -74.0060},
      {"lat": 40.7580, "lon": -73.9855}
    ]
  }
  ```
- **Response Schema Model**: `RouteScoreResponse`
- **Response Example** (200 OK):
  ```json
  {
    "heat_safety_score": 0.8,
    "shade_safety_score": 0.5,
    "overall_score": 0.75
  }
  ```

## Week 2 Integration Checklist
- [ ] Dev B wires `GET /conditions` -> `POST /score-route` heat_index + aqi params
- [ ] Dev B wires `POST /preferences` -> sensitivity params
- [ ] Dev A replaces defaults with live calls
- [ ] Joint integration test: full route with real heat + shade + AQI
