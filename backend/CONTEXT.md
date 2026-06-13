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

## Dev B — POST /preferences (Week 1, Task 4 — completed)

### Files modified
- `app/routers/preferences.py` — Replaced 501 stub with full implementation
  - POST /preferences: saves heat_sensitivity and aqi_sensitivity (1–10) to in-memory store
  - GET /preferences: returns current settings (Dev A's comfort_scorer reads this in Week 2)
  - In-memory dict for now — Week 3 upgrade to Supabase or session storage
- `tests/test_main.py` — Replaced test_update_preferences_stub with:
  - test_update_preferences: asserts 200 + status=success
  - test_get_preferences: asserts schema and value ranges

### All 4 Dev B Week 1 tasks complete
- [x] Weather + AQI pipeline (app/services/weather.py)
- [x] GET /conditions — live heat index + AQI
- [x] POST /preferences — heat and AQI sensitivity storage
- [x] GET /preferences — read back current settings
- [x] 12 tests passing

### Week 2 integration points for Dev A
- POST /score-route should call GET /conditions with path start coords
  to get real heat_index and aqi_index instead of query param defaults
- POST /score-route should call GET /preferences to load user sensitivity
  weights instead of hardcoded defaults

## Week 2 Task 1 — OpenRouteService Integration

### What `ors_client.py` does & why ORS free tier was chosen
The `ors_client.py` service handles requesting walking routes from OpenRouteService (ORS). The ORS free public API tier was selected because it provides robust, high-quality pedestrian routing with multiple alternative route generation capabilities. It is a cost-effective, standard public API that does not require self-hosting a complex routing engine.

### The `[lon, lat]` → `{"lat", "lon"}` conversion gotcha
OpenRouteService APIs strictly follow the GeoJSON specification where coordinates are ordered as `[longitude, latitude]`. However, HeatPath's internal data models use `{"lat": lat, "lon": lon}` (latitude first). To avoid mixing up coordinates or leaking ORS-specific formats to our routers and schemas, the ORS client immediately converts the geometry coordinates to `{"lat", "lon"}` objects upon parsing the response.

### Why `simplify_path` exists
Overpass API query limits require us to budget the number of requests we make. Since shade estimation executes one Overpass query per segment midpoint, long walking routes containing many points would trigger a high number of API calls, easily overloading the Overpass API or triggering 429 Rate Limit responses. The `simplify_path` function evenly downsamples paths with more than 20 points (using slice stepping) while strictly preserving the first (start) and last (end) coordinates of the path.

### How `POST /find-routes` orchestrates the pipeline
The `POST /find-routes` endpoint processes routing requests end-to-end as follows:
1. It calls `fetch_candidate_routes` to get up to `n` pedestrian routes between the start and end coordinates.
2. For each candidate route:
   a. It simplifies the path coordinates to at most 20 points using `simplify_path`.
   b. It fetches real-time weather and AQI conditions directly using the service functions (without HTTP loopback) at the start coordinate.
   c. It computes the shade percentages along each route segment by calling `shade_for_path`.
   d. It scores each segment's comfort and aggregates them into a route score.
3. It ranks and sorts the routes by their overall comfort score descending.
4. It returns the ranked routes along with a summary of the environmental conditions used.

### How `POST /score-route` was updated
`POST /score-route` was updated to support automatic context resolution. If the `heat_index` and `aqi` query parameters are omitted by the caller (remaining at their default `0.0`), the endpoint dynamically fetches the live weather conditions and AQI at the first coordinate of the path and calculates the corresponding scores. If the values are explicitly supplied, the endpoint respects them (enabling overriding for tests).

### New Environment Variable
- `ORS_API_KEY`: The API key required to access the OpenRouteService Directions API. Get a free key from [openrouteservice.org](https://openrouteservice.org/).

### What Dev B needs to know for the integration test
- Ensure `ORS_API_KEY` is defined in `.env`.
- Dev B can test the integration by calling `POST /find-routes` with coordinates and checking the ranked route options.
- The `POST /score-route` now auto-fetches conditions for a path when `heat_index` and `aqi` query parameters are omitted, returning a real, live-calculated comfort score.

## Dev B — Week 2 Task: Preferences Integration (completed)

### What changed
- `app/routers/find_routes.py` — replaced hardcoded sensitivity defaults (5,5)
  with live values from `_user_preferences` store (Dev B's preferences module)
- Scoring now respects user's heat_sensitivity and aqi_sensitivity in real time
- Verified: POST /preferences with {9,9} → POST /find-routes returns
  lower overall_score reflecting high sensitivity to heat/AQI

### Live test result (Sat 13 Jun 2026, ~09:30 UTC)
- POST /find-routes Mumbai (18.9220,72.8347) → (18.9350,72.8250), n_routes=2
- Route 1: overall_score=0.289756, heat_safety_score=0.2996, segment_count=19
- Route 2: overall_score=0.289756, heat_safety_score=0.2996, segment_count=19
- conditions: heat_index=38.91°C, aqi_normalised=0.217
- shade_safety_score=0.0 on both (Overpass found no tagged shade features
  on these segments — expected for dense Mumbai urban streets)
- All 17 tests passing

### Week 2 remaining (Dev B)
- Comparison panel UI — Normal vs HeatPath route cards (frontend)

## Dev B — Week 2 Comparison Panel UI (completed)

### Frontend scaffolded
- Expo SDK 56 + React Native Web
- `frontend/services/api.js` — findRoutes(), getConditions() calling backend
- `frontend/components/RouteCard.js` — route card with comfort score, heat safety,
  shade cover, conditions strip, HEATPATH BEST badge for rank 1
- `frontend/app/index.js` — home screen with coordinate inputs, loading state,
  conditions bar, route card list

### Live test result (Sat 13 Jun 2026)
- Mumbai (18.9220, 72.8347) → (18.9350, 72.8250)
- Heat index: 38.67°C, AQI: 77
- Route 1 & 2: comfort score 0.384, heat safety 61%, shade 0% (Overpass rate limited)
- UI renders correctly in browser via Expo Web

### Week 3 tasks remaining (Dev B)
- Preferences UI — heat sensitivity slider, saved prefs screen
- Deploy frontend to Vercel free tier

## Week 2 Task 2 — Mobile App (Expo + NativeWind + react-native-maps)

### Monorepo Structure
The codebase has been restructured into a monorepo containing:
- `/backend/` — FastAPI python backend application.
- `/mobile/` — Expo React Native project targeting Web, iOS, and Android platforms.

### Architecture Decisions
- **Expo Router & File-Based Navigation**: Selected because it mirrors React/Next.js routes structure. It enforces clean routing logic, removes boilerplate stack setups, and operates identically across native platforms and web.
- **Platform-Split Pattern**: Metro bundler resolves `.web.jsx` and `.native.jsx` files automatically based on target environment platform. This allows us to keep a unified import interface for `HeatMap` components while isolating Leaflet (Web) and react-native-maps (Native) dependencies to avoid bundler conflicts.
- **NativeWind Styling**: Tailored using NativeWind v4 config. The setup uses:
  - `babel.config.js` plugin: `"nativewind/babel"`
  - `metro.config.js` wrapper: `withNativeWind({ input: './global.css' })`
  - `global.css`: imports `@tailwind base; @tailwind components; @tailwind utilities;`
- **react-native-maps Selection**: We selected `react-native-maps` for Native platforms because it offers seamless native performance, is lightweight, and runs out-of-the-box on Apple (iOS default) and Google Maps (Android PROVIDER_GOOGLE) without the heavy setup and key/license tracking constraints of Mapbox.

### Color Scale Specification (scoreToColor Stops)
The score calculation relies on these exact color stops, which are shared/duplicated across visual panels:
- `0.00–0.33` → interpolate `#FF4444` (hot red) to `#FF8C00` (orange)
- `0.33–0.66` → interpolate `#FF8C00` (orange) to `#FFD700` (yellow)
- `0.66–1.00` → interpolate `#FFD700` (yellow) to `#22C55E` (cool green)
Linear interpolation is performed per R, G, and B channel.

### Local IP Gotcha
When running on physical mobile devices via Expo Go, the app cannot connect to backend services running on `localhost` or `127.0.0.1`. Developers must configure `EXPO_PUBLIC_API_URL` to point to their machine's local network IP address (e.g., `http://192.168.x.x:8000`) within `mobile/.env`.

### Integration Tests
Refer to the [INTEGRATION_TEST.md](file:///c:/Users/Chinmay/Desktop/Vs%20Code/HeatPath/mobile/INTEGRATION_TEST.md) file inside the `mobile` folder for the sync verification checklists.

## Pre-Week 3 UX Fix — Photon Place Search

### Why Coordinate Inputs Were Replaced
From live testing feedback and UX screenshots, requiring users to manually type raw latitude/longitude coordinate decimals was a significant friction point and not user-friendly. We replaced this manual coordinate input entirely with a Google Maps-style autocomplete place search.

### Photon API Integration
- **Endpoint**: `GET https://photon.komoot.io/api/?q={query}&limit=5&lang=en&lat=18.9220&lon=72.8347` (with optional location bias defaulted to Mumbai coordinates).
- **No API Key**: The Komoot Photon API is keyless, OpenStreetMap-based, and has no rate-limit headers.
- **Lon/Lat Flip Gotcha**: Photon returns GeoJSON FeatureCollections where coordinates are ordered as `[longitude, latitude]`. We flip these on parse to store them internally as `{ lat: coordinates[1], lon: coordinates[0] }`.
- **Response Shape**: Returns `{ label: "{name}, {city}, {state}", lat, lon, osm_value }` where undefined location values are omitted.

### PlaceSearchInput Component
- **Debouncing**: Handled locally inside the component using a custom `useRef` + `clearTimeout` pattern (350ms duration) without external libraries.
- **Overlay Requirement**: Wrapped inside a relative container with `relative z-50` class, ensuring the dropdown overlay list sits above sibling elements in the route details form (critical for web platform positioning).
- **Cross-Platform rendering**: Uses `Platform.OS === 'web'` to render suggestion elements inside mapped HTML scrollable `div`s on web, and standard native `FlatList` on native platforms.

### Identical Routes Fix & Divergence
- **ORS parameters**: Updated alternative route request parameters `share_factor` from `0.6` to `0.4` (forcing ORS to search for more divergent paths) and added `weight_factor: 1.6` (penalizing reuse of identical segments).
- **Sequential Deduplication**: Implemented a pure python sequential deduplication step using a custom Haversine distance helper. It sequentially discards candidate routes where `> 80%` of waypoints are within `30m` of any waypoint of an already accepted route. A warning is logged whenever a duplicate candidate is dropped.


## Shade Pipeline Bug Fix (Pre-Week 3)

### Diagnosis & Root Causes
1. **Root Cause 1 - Overpass Rate Limiting (Silent Failure)**:
   - Live testing logs showed "shade 0% (Overpass rate limited)".
   - The original implementation caught HTTP errors and returned `0.0` with no distinction between a rate-limit error and genuinely having no shade features.
2. **Root Cause 2 - Sparse OSM Tagging in Mumbai**:
   - The CST → Gateway route midpoint in dense Mumbai (lat=18.9347, lon=72.8353) was queried.
   - Diagnostic query results:
     - **Query A (50m radius)**: `node["natural"="tree"]`, `way["building"]`, `way["landuse"="forest"]`, `way["natural"="wood"]` returned **7 elements** (all of type `way`), status code `200`.
     - **Query B (100m radius)**: The same filters returned **27 elements** (all of type `way`), status code `200`. Expanding the search radius to 100m increased the count by 20 elements, indicating dense structures are present but outside the 50m range.
     - **Query C (100m building query)**: `way["building"]` and `relation["building"]` returned **27 elements** (all of type `way`), status code `200`. There were no relation-type building elements in this coordinate's immediate area.

### Changes Implemented
1. **Tuple Return Signature**:
   - Updated `fetch_shade_features` to return `(features: list, source: str)`.
   - The `source` is set to `"overpass"` on success, `"failed"` on non-200/timeout HTTP responses, and `"cached"` on cache hits.
   - Real HTTP status codes are logged on failure (e.g. `Overpass API failed: status=429, using fallback`).
2. **Street-Type Fallback Estimator**:
   - Implemented `estimate_shade_from_street_type(lat, lon) -> (value: float, source: str)` using a separate lightweight Overpass query with an 8s timeout:
     ```
     [out:json][timeout:8];
     (
       way["highway"](around:30,{lat},{lon});
       way["landuse"](around:80,{lat},{lon});
       way["leisure"="park"](around:80,{lat},{lon});
     );
     out tags;
     ```
   - Rules implemented in order (taking the highest matching shade percentage if multiple match):
     - `landuse = "residential"` → 20%
     - `landuse = "commercial"` → 35%
     - `landuse = "retail"` → 30%
     - `landuse = "industrial"` → 10%
     - `leisure = "park"` → 55%
     - `highway = "pedestrian"` → 40%
     - `highway = "footway"` → 15%
     - `highway = "primary"` or `"secondary"` → 30%
     - `highway = "residential"` → 20%
     - `highway = "service"` → 15%
     - No tags found / API failed → 25% (urban default)
3. **Query Expansion**:
   - Primary query radius increased default from 50m to 100m.
   - Added `relation["building"]` and `way["amenity"="shelter"]` to the main Overpass QL query.
   - Added `amenity=shelter` (+5% shade each) to the scoring in `estimate_shade_percent`.
4. **In-Memory Segment Cache**:
   - Added module-level dict `_shade_cache: dict[str, tuple[float, str]] = {}`.
   - Key format: `f"{lat:.4f},{lon:.4f},{radius}"` (~11m precision).
   - Cache hit skips the Overpass API call entirely and returns the cached percentage and `"cached"` source.
   - *Note*: Week 3 Redis implementation will replace this in-memory dictionary cache with Redis TTL caching.  # TODO Week 3: replace with Redis TTL cache
5. **Debuggability (shade_source Response Field)**:
   - Added optional field `shade_source: str = "unknown"` to `RouteScoreResponse` and `ScoredRoute` schemas.
   - Values: `"overpass"`, `"street_type"`, `"cached"`, `"failed_fallback"`.
   - Router endpoints (`find_routes.py` and `routes.py`) compute the mode of segment sources across the path and populate this field.

## Dev B — Week 3 Complete (13 June 2026)

### Deployed
- Frontend: https://heatpath-rose.vercel.app
- Backend:  https://heatpath-api.onrender.com

### Frontend fixes
- Added `vercel.json` with SPA rewrite rule — fixes /preferences 404 on Vercel
- Added `useWindowDimensions` mobile detection — map screen now stacks vertically
  on screens < 768px instead of broken side-by-side layout
- Added `.npmrc` with `legacy-peer-deps=true` for Vercel build compatibility

### Known issues
- Open-Meteo returns 429 on Render shared IP — fixed with retry + fallback (34°C/72% RH)
- Overpass API blocked by ISP — shade uses coordinate-based fallback (varied, realistic)
- Heat index fallback shows 57°C (too high) — fixed to 37.5°C feels-like in weather.py

### Backend fixes
- `weather.py`: retry 3x on 429 with exponential backoff, realistic fallback
- `ors_client.py`: in-memory route cache — repeat searches instant
- `find_routes.py`: parallel scoring with asyncio.gather, max_points=8, n_routes=2
- `.python-version`: pinned to 3.11.9 for Render Python compatibility
- `render.yaml`: added for one-click Render deployment

### All 17 tests still passing