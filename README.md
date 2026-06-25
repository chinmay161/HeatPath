# HeatPath Monorepo

HeatPath is a heat-aware and air-quality-aware outdoor routing application designed to help pedestrians navigate through cooler and shadier paths. This monorepo contains both the FastAPI Python backend and the cross-platform Expo React Native app.

## Project Structure

- `backend/` — The FastAPI python service handling OpenStreetMap shade querying, weather/AQI conditions index generation, and path safety score routing calculations.
- `mobile/` — The Expo mobile and web application built with React Native, NativeWind, react-native-maps, and React-Leaflet.

---

## Backend Setup & Run

Navigate to the `backend/` folder:

1. **Create and activate a virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   Copy the example file to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
   Provide valid values for:
   - `ORS_API_KEY` (from OpenRouteService)
   - `WAQI_TOKEN` (from World Air Quality Index)
   - `POSTGIS_DSN` (e.g., `postgresql://heatpath_app:heatpath_secure_pass_2026@127.0.0.1:5433/heatpath_osm`)

4. **Set up PostGIS database (WSL Ubuntu):**
   Ensure you have a Western Zone OSM PBF file at the repository root (`./western-zone-latest.osm.pbf`).
   Run the setup script inside your WSL command line:
   ```bash
   ./backend/scripts/setup_postgis.sh
   ```
   This will clip the coastline, spin up the local PostgreSQL service on port `5433`, import data using `osm2pgsql`, and build spatial GIST indexes.

5. **Run the development server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will run at `http://localhost:8000`. You can view the docs at `http://localhost:8000/docs`.

6. **Run tests:**
   ```bash
   pytest
   ```

---

## Mobile Application Setup & Run

Navigate to the `mobile/` folder:

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure environment variables:**
   Copy the example file to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
   Set `EXPO_PUBLIC_API_URL` to point to the backend server.
   - For **web development**: `http://localhost:8000` is fine.
   - For **native development (Expo Go)**: Use your local machine's IP (e.g. `http://192.168.x.x:8000`) so your physical device can connect to the server.

3. **Start the Web app:**
   ```bash
   npx expo start --web
   ```

4. **Start the Native app (iOS/Android):**
   ```bash
   npx expo start
   ```
   Scan the printed QR code using the **Expo Go** app on your physical iOS or Android device.

---

## Integration Tests
To sync and test the complete client-server loop, refer to the [INTEGRATION_TEST.md](file:///c:/Users/Chinmay/Desktop/Vs%20Code/HeatPath/mobile/INTEGRATION_TEST.md) instructions.
