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
