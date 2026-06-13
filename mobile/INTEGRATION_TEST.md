# Week 2 Integration Test Checklist

This checklist acts as the sync point for verification with Dev B to validate the cross-platform frontend and FastAPI backend integration.

## Pre-requisites
- [ ] **Backend Server**: Run FastAPI backend from `backend/` directory:
  ```bash
  uvicorn app.main:app --reload --port 8000
  ```
- [ ] **Mobile Web App**: Start the Expo web dev server from `mobile/` directory:
  ```bash
  npx expo start --web
  ```
- [ ] **Mobile Native App**: Start the Expo native dev server from `mobile/` directory:
  ```bash
  npx expo start
  ```
  Scan the QR code using the **Expo Go** application on an iOS or Android device.
- [ ] **API Keys**: Ensure `ORS_API_KEY` and `WAQI_TOKEN` are correctly set in `backend/.env`.
- [ ] **API URL Configuration**: Set `EXPO_PUBLIC_API_URL` to `http://<your-machine-ip>:8000` in `mobile/.env` (replace `<your-machine-ip>` with your local network IP; using `localhost` will not connect from physical devices running Expo Go).

## Cross-Platform Tests
- [ ] **Web Rendering**: 3 routes render as coloured polylines on Leaflet map in the browser.
- [ ] **Native Rendering**: 3 routes render on Google Maps (Android) or Apple Maps (iOS) with correct stroke colours.
- [ ] **Score to Color Lower Boundary**: Verify in JS Console that `scoreToColor(0.0)` returns `"#FF4444"`.
- [ ] **Score to Color Upper Boundary**: Verify in JS Console that `scoreToColor(1.0)` returns `"#22C55E"`.
- [ ] **Route Interactivity**: Tapping a `RouteCard` correctly selects and highlights the corresponding polyline on both Web and Native maps.
- [ ] **Live Conditions Badge**: The overlay badge displays live `heat_index` temperature and `AQI` air quality index (non-zero value check).
- [ ] **Animated Score Bar**: The `ScoreBar` transitions its width from `0%` to the target percentage value on initial mount (verified visually on Web and Native).
- [ ] **Clean Navigation**: Back navigation (`←` button) from the map results view to the coordinate inputs screen operates cleanly.

## Dev B Sign-off
- [ ] **Badged Index Match**: The `heat_index` displayed in the conditions badge matches the result of a direct `GET /conditions` request for the starting coordinate.
- [ ] **Visual Hierarchy**: Route 1 (Rank 1 / overall coolest) is visually highlighted in green or represents the greenest path on both platforms.
- [ ] **CORS Openness**: No CORS errors are reported in the web browser console when connecting to the API.
- [ ] **Routing Performance**: The response time for `POST /find-routes` for 3 candidates is less than 10 seconds.
