# HeatPath Backend Context

## What is HeatPath?
HeatPath is an innovative, heat-aware outdoor routing application designed to help pedestrians navigate through cooler and shadier paths. By integrating real-time weather, shade, and Air Quality Index (AQI) data, HeatPath calculates optimal routes that prioritize user comfort and safety against environmental hazards like extreme heat and poor air quality.

## What was done in this session
In this session, a production-ready FastAPI backend was scaffolded from scratch. I created the following files to establish the foundation:
- `backend/app/__init__.py`, `backend/app/routers/__init__.py`, `backend/app/models/__init__.py`: Package initialization files to structure the app into logical modules.
- `backend/app/main.py`: The entry point of the application, configuring FastAPI, CORS middleware, and including all routers. It also has a basic health check endpoint.
- `backend/app/config.py`: Configuration module using `python-dotenv` to load environment variables.
- `backend/app/models/schemas.py`: Pydantic v2 schemas for request and response validation for all API endpoints.
- `backend/app/routers/conditions.py`: Router stub for the `GET /conditions` endpoint.
- `backend/app/routers/routes.py`: Router stub for the `POST /score-route` endpoint.
- `backend/app/routers/preferences.py`: Router stub for the `POST /preferences` endpoint.
- `backend/tests/test_main.py`: Pytest smoke tests to verify the health check and that stub endpoints correctly return 501 Not Implemented.
- `backend/.env.example`: A template for required environment variables.
- `backend/requirements.txt`: Pinned exact versions of core dependencies.
- `backend/README.md`: Instructions for setting up and running the application.

## Architecture Decisions
- **FastAPI**: Chosen for its high performance, native async support, and automatic OpenAPI documentation generation. It is ideal for an I/O bound API like HeatPath that will rely heavily on external weather and routing APIs.
- **Pydantic v2**: Provides strict, performant type validation and serialization. Used strictly via `model_config` (no deprecated `class Config`) to future-proof the codebase and ensure the API contracts are robust.
- **Folder Layout**: The `app/` directory separates application code from deployment and testing logic. Breaking down the logic into `routers/` (controllers) and `models/` (schemas/types) ensures a clear separation of concerns, making the codebase maintainable as the project grows.

## API Contract Stubs
This is the expected API contract for the endpoints:

### `GET /conditions`
- **Description**: Get environmental conditions for a location.
- **Query Params**:
  - `lat` (float): Latitude
  - `lon` (float): Longitude
- **Response** (200 OK):
  ```json
  {
    "heat_index": 0.0,
    "shade_index": 0.0,
    "aqi_index": 0.0
  }
  ```

### `POST /score-route`
- **Description**: Score a pedestrian path based on heat, shade, and AQI.
- **Request**:
  ```json
  {
    "path": [
      {"lat": 0.0, "lon": 0.0},
      {"lat": 0.0, "lon": 0.0}
    ]
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "heat_safety_score": 0.0,
    "shade_safety_score": 0.0,
    "overall_score": 0.0
  }
  ```

### `POST /preferences`
- **Description**: Update user routing preferences.
- **Request**:
  ```json
  {
    "heat_sensitivity": 5,
    "aqi_sensitivity": 5
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "status": "success"
  }
  ```

## Environment Variables
- `PORT`: Port the server runs on. Example: `8000`
- `ENV`: The environment (e.g., development, production). Example: `development`
- `API_KEY_PLACEHOLDER`: Example key for future integrations. Example: `your_api_key_here`

## What Dev B Needs From Me
Dev B (working on the Weather+AQI pipeline) needs this API contract to know exactly what request shapes the frontend/routing engine will send and what response formats are expected. Dev B can now build the business logic that fulfills the input/output expectations defined in the `ConditionsResponse` and `RouteScoreResponse` Pydantic models.

## Left as TODOs
Currently, all endpoint logic inside the routers (`conditions.py`, `routes.py`, `preferences.py`) is stubbed out to return a 501 Not Implemented error. This is because actual business logic is deferred past Week 1. The stubs serve as placeholders to enforce the API contract until the actual integrations (such as the Weather+AQI pipeline) are ready to be plugged in.

## How to Run Locally and Run Tests

1. **Setup Virtual Environment**:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment setup**:
   ```bash
   cp .env.example .env
   ```

4. **Run Server**:
   ```bash
   uvicorn app.main:app --reload
   ```

5. **Run Tests**:
   ```bash
   pytest
   ```

## Task 2 — OSM Shade Fetcher
The `osm_shade` service is responsible for querying open map data to calculate the amount of shade available along a pedestrian route. The **Overpass API** was chosen because it allows for powerful, dynamic queries (Overpass QL) of OpenStreetMap data, letting us efficiently fetch specific shade-contributing features like individual trees, forests, and buildings around given coordinates without hosting a massive full-planet OSM database locally.

### Shade Scoring Heuristic
The heuristic calculates shade based on the following exact weights for features found within a 50m radius of a path segment midpoint:
- **Individual trees** (`natural=tree`): +5% shade per tree.
- **Buildings** (`building=*`): +8% shade per building.
- **Forest/Wood areas** (`landuse=forest` or `natural=wood`): +10% shade per area.
- The total shade percentage for a segment is **capped at 95%**.

### Mapping to POST /score-route
The `shade_for_path` function accepts a path array conforming to the `POST /score-route` contract (e.g., `[{"lat": 40.71, "lon": -74.00}, ...]`). It breaks the path into segments, computes the geographic midpoint for each segment, and fetches the shade score. The `POST /score-route` endpoint averages these segment scores, normalises the average to a 0.0–1.0 range, and returns it as the `shade_safety_score`.

### Stubbed Data
The `heat_safety_score` and `overall_score` are still stubbed to `0.0`. These depend on the Weather and AQI data pipeline which is currently being built by Dev B. Once Dev B completes the conditions module, these scores will be dynamically calculated.

### Rate-Limiting & Overpass Fair-Use
- **Timeouts & Graceful Degradation:** The Overpass API is a free, shared resource and can occasionally be slow or return 429 (Too Many Requests). The `httpx.AsyncClient` is configured with a 10s timeout. If the API fails or times out, the service handles it gracefully by returning `0.0` (0% shade) for that specific segment rather than failing the entire route.
- **Future Considerations:** Dev B or future devs should consider implementing caching (e.g., Redis) for bounding boxes or coordinates to reduce direct calls to Overpass API and comply with their Fair Use Policy if traffic increases.

### Edge Cases Handled
- **API Errors:** As mentioned, timeouts or bad responses return a 0.0 shade score for the segment, allowing the rest of the route to process.
- **Single-Point Paths:** If a route contains fewer than 2 points, it cannot form a segment. The endpoint handles this gracefully by returning early with all scores set to `0.0`.

## Task 3 — Route Comfort Scorer
The `comfort_scorer.py` service is a pure-logic module that calculates route comfort. It takes pre-fetched environmental data per segment (shade, heat, AQI) and user sensitivities, calculating segment comfort scores and overall route safety/comfort scores.

### Exact Formula Used
```python
shade_score   = shade_pct / 95.0           # normalise shade to 0–1
heat_penalty  = min(heat_index / 50.0, 1.0) * (heat_sensitivity / 10.0)
aqi_penalty   = min(aqi / 300.0, 1.0)      * (aqi_sensitivity / 10.0)
comfort       = shade_score * 0.5 - heat_penalty * 0.3 - aqi_penalty * 0.2
return max(0.0, min(1.0, comfort + 0.5))   # centre and clamp to [0, 1]
```

### POST /score-route Orchestration
The `POST /score-route` endpoint now orchestrates both `osm_shade` and `comfort_scorer`. It first calls `shade_for_path` to get the shade percentages for the route segments. It then merges those values with the supplied (or default) heat index, AQI, and sensitivity parameters, and hands the complete list of segments off to `comfort_scorer.score_route()`. The endpoint then constructs the response using the newly generated overall scores.

### Optional Parameters & Week 2 Hand-off
The endpoint currently accepts `heat_index`, `aqi`, `heat_sensitivity`, and `aqi_sensitivity` as optional query parameters with default values (0.0 for environmental, 5 for sensitivities). 
- In **Week 2**, Dev B will inject the real values by mapping the path's starting coordinate to `GET /conditions` (for heat/AQI) and loading stored user preferences from `POST /preferences` (for sensitivities). 
- See `API_CONTRACT.md` for the finalized request/response shapes and Dev B's exact integration checklist.

## Dev B — Week 1 Completed (June 2026)

### Files created / modified
- `app/services/weather.py` — Live weather + AQI service (was empty, now fully implemented)
  - `get_weather()`: Fetches temperature_c, humidity_pct, feels_like_c from Open-Meteo (no API key needed)
  - `get_aqi()`: Fetches AQI from WAQI API, falls back to 50 if token missing
  - `compute_heat_index()`: Steadman formula, accurate for Indian summer range (>27°C)
- `app/routers/conditions.py` — Replaced 501 stub with full implementation
  - Returns real heat_index (°C), aqi_index (0.0–1.0 normalised), shade_index (0.0, Dev A owns)
- `tests/test_main.py` — Updated test_get_conditions_stub → test_get_conditions_live (asserts 200 + schema)

### Dependencies added to requirements.txt
- `pytest-httpx==0.30.0`
- `pytest-asyncio==0.23.6`
- Pinned `httpx==0.27.0` to fix TestClient compatibility

### Environment variables needed
- `WAQI_TOKEN`: Free token from https://aqicn.org/data-platform/token/
  (fallback to AQI=50 if not set — safe for development)

### Live test result (Sat 13 Jun 2026, 07:56 UTC)
- GET /conditions/?lat=18.9220&lon=72.8347 (Mumbai)
- Response: { "heat_index": 39.55, "shade_index": 0.0, "aqi_index": 0.1 }
- All 11 tests passing

### What Dev A needs from me (Week 2 integration)
- When POST /score-route runs, it should call GET /conditions with the path's
  start coordinate to get real heat_index and aqi_index values
- Those slot into comfort_scorer.py's heat_index and aqi parameters
- shade_index will be populated by Dev A's OSM module and returned alongside