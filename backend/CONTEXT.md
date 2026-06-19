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

## Week 3 Task 1 — SQLite Tile Cache

### Design Rationale

#### Why 250m tiles were chosen over 500m
250m tiles provide a sweet spot between database size and spatial accuracy. Large 500m tiles introduce the "park-edge problem", where a single shade percentage calculated near a highly shaded area (like a park or dense cluster of buildings) gets incorrectly attributed to distant streets on the other side of the tile, leading to inaccurate route scores. Snapping coordinates to 250m tiles maintains local street-level precision while keeping the grid footprint compact.

#### Why radius_m=60 instead of 100
With 250m tiles, the radius of the Overpass query must be carefully sized. Using the default `radius_m=100` would query a 200m diameter circle, leading to significant bleed/overlap between adjacent 250m tiles. Restricting `radius_m=60` guarantees that the queried features stay well within the boundary of the snapped tile without bleeding into and duplicate-scoring neighboring tiles.

#### TILE_SIZE constant derivation
The tile size in degrees is calculated based on the earth's curvature at Mumbai's latitude (18.9°N):
- 1° latitude ≈ 111 km = 111,000 m.
- Snapping to a 250m grid requires:
  TILE_SIZE = 250m / 111,000 m/° ≈ 0.00225°
Thus, `TILE_SIZE` is exactly `0.00225`.

#### Route-Level Batching & Deduplication
Previously, shade scoring query loops fetched features sequentially per segment midpoint. If multiple segments shared the same coordinate tile, this resulted in redundant HTTP queries and slow route scoring. Snapping all midpoints along the route first, deduplicating them into unique tile keys, and performing a bulk SQLite check solves this. Only missing tiles are fetched in parallel via `asyncio.gather`, dramatically improving latency.

### SQLite Schema and Implementation

The database file is located at `backend/data/shade_tiles.db` and is ignored by git (added to `.gitignore`). A `.gitkeep` tracks the empty `backend/data/` directory.

The `shade_tiles` table has the following columns:
- `tile_key` (TEXT PRIMARY KEY): Formatted string representation of snapped coordinate boundary `"{lat4}_{lon4}"` (e.g. `18.9250_72.8250`).
- `shade_pct` (REAL NOT NULL): Computed shade percentage (0.0 to 95.0).
- `source` (TEXT NOT NULL): The shade data source: `"overpass"` (from OSM trees/buildings query), `"street_type"` (fallback tags), or `"fallback"` (hardcoded fallback due to overall connection failure).
- `computed_at` (TEXT NOT NULL): ISO-8601 UTC timestamp recording when the tile was calculated.
- `radius_m` (INTEGER NOT NULL): Always `60` for 250m tiles.

An index `idx_tile_key` is created on `tile_key` to ensure O(1) bulk fetch queries.

#### 30-Day TTL Rationale
To keep the SQLite database lean without requiring a background thread, expired rows are evicted at module import. A 30-day TTL was chosen because OpenStreetMap features (like buildings, trees, and street networks) change slowly. Evicting and recalculating once a month ensures data freshness while minimizing unnecessary API calls.

### Warmup Script

The warmup script pre-computes the entire Mumbai grid:
- **Location**: `backend/scripts/warmup_shade_cache.py`
- **Mumbai Bounding Box**: Latitudes `18.870` to `19.270`, Longitudes `72.770` to `73.050`.
- **Usage**:
  ```bash
  python backend/scripts/warmup_shade_cache.py [--dry-run]
  ```
- **Fair-Use Delay**: The script enforces an `asyncio.sleep(0.5)` delay between Overpass queries to comply with fair-use guidelines and prevent rate-limiting.
- **Expected Time**: The grid contains 22,250 tiles. Pre-fetching all missing tiles sequentially with a 0.5s delay takes around 3 hours if starting from empty.
- **Dry-run**: The `--dry-run` flag prints the total grid tiles and missing tiles count without initiating any fetches.

### Cache Stats & Monitoring

The health check endpoint at `GET /health` now exposes cache statistics:
```json
{
  "status": "ok",
  "env": "production",
  "shade_cache": {
    "total_tiles": 42,
    "oldest_tile": "2026-06-14T06:34:00Z",
    "db_path": "backend/data/shade_tiles.db"
  }
}
```
This allows operators to monitor cache size and age on the live deployment.

## Shade v2 — Time-Aware Structural Shade

### solar.py
This module is a pure Python implementation utilizing only standard library `math` and `datetime` modules. It computes the solar elevation angle above the horizon at any coordinate and time using the NOAA simplified algorithm. This algorithm is accurate to approximately ±0.5° for our purposes, which is more than sufficient for shade estimation.

### elevation_to_shade_multiplier
The solar elevation angle is mapped to a shade effectiveness multiplier using a step function:
- `elevation <= 0°` -> `0.0` (sun below horizon, night time, shade is irrelevant)
- `0° < elevation <= 10°` -> `0.15` (sunrise/sunset, very long shadows, little radiant heat)
- `10° < elevation <= 25°` -> `0.45` (morning/evening, moderate shadow length)
- `25° < elevation <= 45°` -> `0.75` (mid-morning/afternoon, significant heat)
- `elevation > 45°` -> `1.0` (high sun, direct sunlight, shade is at maximum effectiveness)

Rationale: When the sun is high and direct (elevation > 45°), shade features are highly critical to protect walkers from peak radiant heat. At low sun angles, buildings and other surrounding features naturally cast long shadows regardless of immediate overhead cover, reducing the relative importance of local shade features.

### New Overpass Features and Examples
We updated the query in `fetch_shade_features` to include structurally accurate and surface shade sources:
- **Bridges & Flyovers**: Road flyovers (`way["bridge"="yes"]["highway"]`) like the Santa Cruz-Chembur Link Road (SCLR) or Eastern Express Highway, and railway bridges (`way["bridge"="yes"]["railway"]`).
- **Covered Walkways & Awnings**: Covered pathways (`way["covered"="yes"]`) and purpose-built canopy structures/roofs (`way["building"="roof"]`) like the arcade structures in the Crawford Market area.
- **Bus Shelters**: Public transport shelters (`node/way["amenity"="shelter"]["shelter_type"="public_transport"]`) representing BEST bus shelters in Mumbai.

### New Scoring Weights Verbatim
The new scoring weights are applied incrementally inside the pure function `estimate_shade_percent`:
- `bridge=yes` + `highway` (road flyover): `+25%` per element
- `bridge=yes` + `railway` (railway bridge): `+20%` per element
- `covered=yes` (covered walkways/markets): `+15%` per element
- `building=roof` (canopies/arcades): `+20%` per element
- `shelter_type=public_transport` (bus shelters): `+10%` per element
The total shade is capped at `95%` as before.

### Application of Solar Multiplier
The solar multiplier is applied inside `fetch_shade_for_tile` rather than inside `estimate_shade_percent`. This maintains `estimate_shade_percent` as a pure feature-scoring function, decoupling spatial features from time-based conditions and keeping both units highly testable.

### TTL Cache Policy Update (30 days -> 6 hours)
Since shade is now time-aware and dependent on the current solar position, tiles cached at noon (high shade multiplier) cannot be served at 6am (low shade multiplier) tomorrow. Solar elevation changes meaningfully every 2-3 hours. Changing the TTL policy to 6 hours ensures that cached values remain valid and fresh for the corresponding part of the day while still avoiding redundant Overpass API calls during rapid repeated queries.

### API Response & Caller Updates
The function `shade_for_path` was refactored to return a dictionary:
```json
{
  "shade_values": [15.0, 25.0],
  "solar_elevation": 55.4,
  "solar_multiplier": 1.0,
  "shade_sources": ["overpass", "cached"]
}
```
All callers of `shade_for_path` have been updated to extract the appropriate fields from the returned dictionary:
- `find_routes.py`: Updated to unpack `shade_values` and `shade_sources` from the dict.
- `routes.py`: Updated to parse `shade_values` and `shade_sources` from the dict.


## Shade v3 — Physical Geometry Model

### Why Shade v2 was Incorrect
In Shade v2, the solar elevation angle was mapped to a multiplier and applied to the *final* shade score. This was physically incorrect because:
- Surrounding structures (buildings) cast longer shadows at lower sun angles, which geometry handles naturally. Applying a multiplier afterwards double-penalised the final score.
- Trees and overhead structural shade (canopies, flyovers) block direct overhead sun regardless of the sun angle; thus, their contribution should not scale down based on the time of day.

### Physical Model Categories
1. **Trees** (`natural=tree`):
   - Contribution: +12% per tree node.
   - Sun-independent (canopy blocks direct overhead sun regardless of sun angle).
2. **Buildings** (`way` or `relation` with `building` tag):
   - Shadow length is calculated using the formula: `shadow_length = height / tan(solar_elevation)`.
   - Shade contribution tier based on shadow length:
     - `shadow_length >= 250m` (segment length) -> 30%
     - `shadow_length >= 125m` (half segment length) -> 20%
     - `shadow_length >= 20m` -> 12%
     - `shadow_length >= 7m` -> 6%
     - `shadow_length < 7m` -> 2%
3. **Forest / Wood** (`landuse=forest` or `natural=wood`):
   - Contribution: +25% per area element.
   - Sun-independent.
4. **Structural Shade** (sun-independent overhead cover):
   - `bridge=yes` + `highway` -> +25%
   - `bridge=yes` + `railway` -> +20%
   - `covered=yes` -> +18%
   - `building=roof` -> +22%
   - `amenity=shelter` -> +8%
   - `shelter_type=public_transport` -> +10%

### Building Height Extraction Priority
Building height is determined in the following order of tag priority:
1. `tags["height"]`: Parses value directly, stripping trailing "m".
2. `tags["building:levels"]`: Calculated as `levels * 3.5` meters.
3. `tags["levels"]`: Calculated as `levels * 3.5` meters.
4. Default height of `12.0m` (approx. 3 levels) if no tags exist or if values are malformed.

### Night Override
If `solar_elevation < 0`, the sun is below the horizon. The model immediately overrides all scores and returns `0.0%` shade.

### API Backward Compatibility
The API response dictionary shape has been preserved. The `solar_multiplier` field is kept in the output dictionary for backward compatibility with existing route callers in `find_routes.py` and `routes.py`, but its value is now set to `1.0` always.

### SQLite Cache version 3 migration
All cached tiles calculated with the legacy v2 multiplier must be invalidated.
- Table `cache_meta` is created with columns `(key TEXT PRIMARY KEY, value TEXT)`.
- On import, a version guard checks if `cache_meta` contains the row `shade_version="v3"`.
- If missing, the migration calls `invalidate_v2_tiles()` to run `DELETE FROM shade_tiles WHERE source != 'night'`, and sets `shade_version` to `"v3"` in `cache_meta`.

### Deleted Functions
- `elevation_to_shade_multiplier()` was completely deleted from `solar.py`.


### Physical Scorer Refinements (Shade v3 Continuous & Vector Model)
To eliminate mathematical discontinuities and step functions, and to model the true physical nature of shadows, the scoring was refined:
- **Night Override (100% Shade):** Rather than returning 0% shade at night (which penalized routing comfort scores), nighttime queries now return 100% shade, representing zero solar exposure.
- **Continuous Shadow Interpolation:** Changed step thresholds into a continuous piece-wise linear function:
  - `shadow_length = 0` -> 2% contribution
  - `shadow_length = 7` -> 6%
  - `shadow_length = 20` -> 12%
  - `shadow_length = 125` -> 20%
  - `shadow_length = 250` -> 30%
- **Tree Canopy Scaling:** Rather than a flat +12% per tree node, trees now parse crown/radius tags (e.g. `crown_diameter`, `radius`, `width`, `height`) and scale their contribution proportionally (capped at 25%).
- **Building Shadow Direction Vector:** Incorporated a solar azimuth factor. If tile coordinates are provided, the building center and bearing from the building to the tile are calculated. The building's shade contribution is scaled by the cosine of the angle difference between this bearing and the shadow direction (direction opposite to the sun's azimuth).

## GET /heat-zones — Gradient Heat Map Backend

### Purpose
`GET /heat-zones` returns a dense grid of scored points for the map heat overlay. This is designed for a smooth weather-radar-style colour gradient, not discrete named pins.

### Request
```http
GET /heat-zones?north={lat}&south={lat}&east={lon}&west={lon}&resolution=15
```

Query parameters:
- `north`, `south`, `east`, `west`: visible map viewport bounds.
- `resolution`: number of grid cells per side. Default is `15`, which produces `(15 + 1) * (15 + 1) = 256` points because the grid includes edges.

### Validation and Abuse Limits
Resolution is clamped between `8` and `25`. This keeps the frontend dense enough for a gradient while preventing very expensive requests. At the upper bound, the endpoint returns `26 * 26 = 676` grid points.

The viewport is capped to less than `0.5° x 0.5°`. Requests with `north <= south` or `east <= west` return `400 Bad Request`. Oversized viewports return:
```json
{"detail": "Viewport too large — zoom in for heat map data"}
```
This prevents accidental or abusive calls for enormous regions such as all of India.

### Weather and AQI Strategy
Weather and AQI are fetched once at the viewport center:
```python
center_lat = (north + south) / 2
center_lon = (east + west) / 2
```
The endpoint calls `get_weather(center_lat, center_lon)` and `get_aqi(center_lat, center_lon)` exactly once per uncached response, then computes heat index once with `compute_heat_index(...)`. This avoids 256+ weather/AQI API calls per map view. Over a city-scale viewport, heat and AQI vary slowly compared to shade, so center-point conditions are a practical performance tradeoff.

### Shade Tile Cache Reuse
Shade varies hyperlocally, so each grid point uses the existing 250m tile cache:
1. Generate the inclusive-edge grid points.
2. Snap every point to an existing tile key through `shade_tile_cache.tile_key(...)`.
3. Deduplicate keys.
4. Bulk lookup with `get_tiles(unique_keys)`.
5. Fetch only missing tiles in parallel with `asyncio.gather(fetch_shade_for_tile(...))`.
6. Store missing results with `store_tiles(...)`.
7. Map each grid point back to its tile's `shade_pct` and `source`.

No second SQLite table was added. The endpoint reuses the existing `shade_tiles` table and keeps response caching separate.

### Response-Level Cache
Heat-zone responses are cached in-memory at the router level for the current 15-minute bucket. The key format is:
```python
cache_key = f"{round(north,2)}_{round(south,2)}_{round(east,2)}_{round(west,2)}_{resolution}_{int(time.time() // 900)}"
```
The cache is a module-level dict in `app/routers/heat_zones.py`, separate from the SQLite tile cache. It is capped at 50 entries and evicts the oldest inserted entry on overflow.

### Response Shape
```json
{
  "grid": [
    {
      "lat": 18.922,
      "lon": 72.8347,
      "comfort_score": 0.62,
      "shade_pct": 35.0,
      "source": "street_type"
    }
  ],
  "resolution": 15,
  "bounds": {
    "north": 18.95,
    "south": 18.92,
    "east": 72.85,
    "west": 72.83
  },
  "conditions": {
    "heat_index": 36.7,
    "aqi": 56.0,
    "solar_phase": "day"
  },
  "generated_at": "2026-06-19T12:00:00+00:00"
}
```

`comfort_score` is normalized from `0.0` to `1.0` for gradient colours. `shade_pct` and `source` are included for tooltips/debugging. Possible sources include `"overpass"`, `"street_type"`, `"cached"`, `"night"`, and fallback values from the existing shade pipeline.

### /find-routes Geometry Verification
Live local integration verification was run against:
```http
POST http://127.0.0.1:8000/find-routes/
```
with:
```json
{
  "start": {"lat": 18.9220, "lon": 72.8347},
  "end": {"lat": 18.9398, "lon": 72.8355},
  "n_routes": 2
}
```

Result: path geometry is intact. The live response returned 1 route with `path` containing 76 coordinate points, which is more than start/end only. The route had `segment_count = 7`, confirming scoring still uses the Week 3 simplified path internally while the API response preserves rich route geometry for map drawing. No geometry fix was required, so no `fix: verify and restore find-routes path geometry` commit was created.

## Heat Map Screen — Gradient Overlay Wiring

### Edited Screen and Supporting Files
The Heat Map tab screen is `mobile/app/(tabs)/map.tsx`. It now renders a live platform-aware heat-zone map instead of the previous mock severity grid and demo-data banner.

Supporting files added or updated:
- `mobile/config/api.ts`: added `getHeatZones(bounds, resolution)` and typed Heat Zones response models.
- `mobile/utils/scoreToColor.ts`: added the shared comfort-score colour interpolation utility.
- `mobile/components/HeatZoneMap.web.tsx`: web Leaflet heat-zone map.
- `mobile/components/HeatZoneMap.native.tsx`: native `react-native-maps` heat-zone map.
- `mobile/components/HeatZoneMap.tsx`: base native export for platform resolution.

### Gradient Approach
Web uses `react-leaflet` with overlapping semi-transparent `CircleMarker` points. `leaflet.heat` was not installed, and no new web dependency was added. The circle markers avoid bundle growth while still creating a soft blended radar-style overlay from the dense backend grid.

Native uses `react-native-maps`. The Expo-compatible version installed is `react-native-maps@1.27.2`. Android uses the exported `Heatmap` component with `PROVIDER_GOOGLE` when available:
```tsx
<Heatmap
  points={grid.map(p => ({
    latitude: p.lat,
    longitude: p.lon,
    weight: p.comfort_score,
  }))}
  radius={50}
  opacity={0.6}
/>
```
If native `Heatmap` is unavailable or the platform is not Android/Google provider, the component falls back to rendering semi-transparent `Circle` overlays per grid point using the same `scoreToColor(...)` mapping.

### Viewport Refetching
The Heat Map screen owns fetch state and does not add client-side response caching because the backend already caches viewport+resolution results for 15 minutes.

Viewport changes are emitted by the platform map components:
- Web: `moveend` and `zoomend` from Leaflet.
- Native: `onRegionChangeComplete` from `react-native-maps`.

`mobile/app/(tabs)/map.tsx` debounces viewport changes for 500 ms using `useRef`, `setTimeout`, and `clearTimeout`. The fetch call is:
```ts
getHeatZones(bounds, resolution)
```

Zoom level maps to backend grid resolution with:
```ts
resolution = clamp(Math.round(zoom * 1.2), 8, 25)
```

The screen also performs an initial fetch for a Mumbai viewport so first load shows a real loading state immediately while waiting for map bounds events.

### Loading and Error States
The old demo-data banner was removed completely from `mobile/app/(tabs)/map.tsx`.

First load shows:
```text
Reading the city heat...
```

Expected oversized viewport errors from the backend are shown as:
```text
Zoom in to see the heat map
```

Other fetch failures follow the existing app tone:
```text
Could not load heat map. Is the backend running?
```

The map remains interactive during fetches; loading and error messages are lightweight overlay chips rather than blocking panels.
