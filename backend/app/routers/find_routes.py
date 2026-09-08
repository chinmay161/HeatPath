# Router for finding and scoring candidate routes.

"""
Router for finding and scoring candidate routes.
"""
import asyncio
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import (
    RouteRequest, ScoredRoutesResponse, ScoredRoute,
    ConditionsSummary, Location
)
from app.services.ors_client import fetch_candidate_routes, simplify_path, haversine_distance
from app.services.weather import get_weather, get_aqi, compute_heat_index
from app.services.osm_shade import shade_for_path
from app.services.comfort_scorer import score_route as calculate_route_scores, estimate_feels_like
from app.routers.preferences import _user_preferences
from app.config import config

router = APIRouter(prefix="/find-routes", tags=["Routes"])


@router.post("/", response_model=ScoredRoutesResponse)
async def find_routes(request: RouteRequest) -> ScoredRoutesResponse:
    """
    Find and score multiple candidate pedestrian routes.
    Capped at 2 routes for speed.
    """
    n = min(request.n_routes, 2)

    try:
        candidate_paths, (weather, raw_aqi) = await asyncio.gather(
            fetch_candidate_routes(
                start_lat=request.start.lat,
                start_lon=request.start.lon,
                end_lat=request.end.lat,
                end_lon=request.end.lon,
                n=n,
            ),
            asyncio.gather(
                get_weather(request.start.lat, request.start.lon),
                get_aqi(request.start.lat, request.start.lon),
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"External API error: {e}",
        )

    if weather.get("status") == "unavailable" or weather.get("temperature_c") is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Weather service temporarily unavailable from provider (Open-Meteo). Route comfort scoring requires live environmental data.",
        )

    heat_index     = compute_heat_index(weather["temperature_c"], weather["humidity_pct"])
    aqi_val        = raw_aqi.get("value") if isinstance(raw_aqi, dict) else raw_aqi
    aqi_normalised = min(float(aqi_val) / 300.0, 1.0) if aqi_val is not None else 0.0
    avoid_crowds   = _user_preferences.get("avoid_crowds", False)

    walking_speed_pref = _user_preferences.get("walking_speed", "normal")
    speed_m_per_min = 60.0 if walking_speed_pref == "slow" else (96.6 if walking_speed_pref == "brisk" else 80.0)

    def get_aqi_category(val) -> str:
        if val is None:
            return "Unknown"
        try:
            v = float(val)
        except (ValueError, TypeError):
            return "Unknown"
        if v <= 50:
            return "Good"
        if v <= 100:
            return "Moderate"
        if v <= 150:
            return "Unhealthy for Sensitive Groups"
        if v <= 200:
            return "Unhealthy"
        if v <= 300:
            return "Very Unhealthy"
        return "Hazardous"

    aqi_cat = get_aqi_category(aqi_val)

    provider_freshness = {
        "weather_provider": weather.get("provider", "Open-Meteo"),
        "weather_observed_at": weather.get("observed_at"),
        "aqi_provider": raw_aqi.get("provider", "Open-Meteo") if isinstance(raw_aqi, dict) else "Open-Meteo",
        "aqi_observed_at": raw_aqi.get("observed_at") if isinstance(raw_aqi, dict) else None,
    }

    async def score_one(path):
        simplified = simplify_path(path, max_points=8)

        # shade_for_path returns a dict with shade_values and solar metadata
        shade_res    = await shade_for_path(simplified)
        shade_pcts   = shade_res["shade_values"]
        shade_sources = shade_res.get("shade_sources", [])
        # Segment distances for the simplified path — aligned with
        # shade_pcts, used to build the exposure timeline on the frontend
        segment_distances = [
            haversine_distance(
                simplified[i]["lat"], simplified[i]["lon"],
                simplified[i + 1]["lat"], simplified[i + 1]["lon"],
            )
            for i in range(len(simplified) - 1)
        ]

        total_dist_m = sum(segment_distances)
        if total_dist_m == 0 and len(path) > 1:
            for i in range(len(path) - 1):
                total_dist_m += haversine_distance(path[i]["lat"], path[i]["lon"], path[i + 1]["lat"], path[i + 1]["lon"])

        duration_min = max(1, round(total_dist_m / speed_m_per_min))

        segments = [
            {
                "shade_pct":        shade_pcts[i],
                "shade_source":     shade_sources[i] if i < len(shade_sources) else "unknown",
                "heat_index":       heat_index,
                "aqi":              aqi_val,
                "crowd_pct":        None,
                "heat_sensitivity": _user_preferences["heat_sensitivity"],
                "aqi_sensitivity":  _user_preferences["aqi_sensitivity"],
                "avoid_crowds":     avoid_crowds,
            }
            for i in range(len(shade_pcts))
        ]
        scores = calculate_route_scores(segments)

        valid_shades = [s for s in shade_pcts if s is not None]
        avg_shade_pct = sum(valid_shades) / len(valid_shades) if valid_shades else 0.0
        feels_like_c  = estimate_feels_like(heat_index, avg_shade_pct)

        heat_hours_avoided = round((avg_shade_pct / 100.0) * (duration_min / 60.0), 2)
        energy_savings_kcal = round((avg_shade_pct / 100.0) * duration_min * 0.85, 1)

        warnings = []
        if heat_index >= 40.0:
            warnings.append("Extreme heat hazard: Heat index exceeds 40°C. Seek shade and hydrate.")
        elif heat_index >= 35.0:
            warnings.append("High heat index: Pace yourself and take frequent shaded breaks.")

        if aqi_val is not None:
            try:
                aqi_f = float(aqi_val)
                if aqi_f > 150:
                    warnings.append(f"Air quality alert: AQI is {int(aqi_f)} ({aqi_cat}). Mask recommended.")
                elif aqi_f > 100:
                    warnings.append(f"Elevated AQI: {int(aqi_f)} ({aqi_cat}). Sensitive groups should take care.")
            except (ValueError, TypeError):
                pass

        if avg_shade_pct < 20.0:
            warnings.append("Low shade alert: Path has minimal tree cover; high direct sun exposure.")

        uv_idx = weather.get("uv_index")
        if uv_idx is not None and uv_idx >= 8:
            warnings.append(f"Very high UV index ({uv_idx}): Wear sun protection.")

        if avg_shade_pct >= 50.0:
            selection_reason = f"Maximized tree canopy and shadow cover ({round(avg_shade_pct)}% shaded), lowering perceived temperature to {round(feels_like_c, 1)}°C."
        elif avg_shade_pct >= 25.0:
            selection_reason = f"Balanced path offering {round(avg_shade_pct)}% shade coverage along pedestrian walkways."
        else:
            selection_reason = f"Direct walking route with {round(avg_shade_pct)}% shade coverage."

        return {
            "score_version":       scores.get("score_version", config.SCORE_VERSION),
            "overall_score":       scores["overall_score"],
            "confidence":          scores.get("confidence", {"value": 1.0, "missing_inputs": [], "degraded_inputs": [], "computed_from": []}),
            "missing_inputs":      scores.get("missing_inputs", []),
            "shade_safety_score":  scores["shade_safety_score"],
            "heat_safety_score":   scores["heat_safety_score"],
            "crowd_safety_score":  None,  # Feature disabled
            "avg_shade_pct":       round(avg_shade_pct, 1),
            "feels_like_c":        feels_like_c,
            "shade_segments":      shade_pcts,
            "shade_sources":       shade_sources,
            "segment_distances_m": [round(d, 1) for d in segment_distances],
            "path":                [Location(lat=pt["lat"], lon=pt["lon"]) for pt in path],
            "segment_count":       len(segments),
            "distance_m":          round(total_dist_m, 1),
            "duration_min":        duration_min,
            "heat_hours_avoided":  heat_hours_avoided,
            "energy_savings_kcal": energy_savings_kcal,
            "warnings":            warnings,
            "provider_freshness":  provider_freshness,
            "aqi_val":             aqi_val,
            "aqi_category":        aqi_cat,
            "selection_reason":    selection_reason,
        }

    scored_list = await asyncio.gather(*[score_one(p) for p in candidate_paths])
    scored_list = sorted(
        scored_list,
        key=lambda x: (x["overall_score"] is not None, x["overall_score"] if x["overall_score"] is not None else -1.0),
        reverse=True
    )

    routes_response = [
        ScoredRoute(
            rank=rank + 1,
            score_version=r["score_version"],
            overall_score=r["overall_score"],
            confidence=r["confidence"],
            missing_inputs=r["missing_inputs"],
            shade_safety_score=r["shade_safety_score"],
            heat_safety_score=r["heat_safety_score"],
            crowd_safety_score=r["crowd_safety_score"],
            avg_shade_pct=r["avg_shade_pct"],
            feels_like_c=r["feels_like_c"],
            shade_segments=r["shade_segments"],
            shade_sources=r["shade_sources"],
            segment_distances_m=r["segment_distances_m"],
            path=r["path"],
            segment_count=r["segment_count"],
            distance_m=r["distance_m"],
            duration_min=r["duration_min"],
            heat_hours_avoided=r["heat_hours_avoided"],
            energy_savings_kcal=r["energy_savings_kcal"],
            warnings=r["warnings"],
            provider_freshness=r["provider_freshness"],
            aqi_val=r["aqi_val"],
            aqi_category=r["aqi_category"],
            selection_reason=r["selection_reason"],
        )
        for rank, r in enumerate(scored_list)
    ]


    return ScoredRoutesResponse(
        score_version=config.SCORE_VERSION,
        routes=routes_response,
        conditions=ConditionsSummary(
            heat_index=heat_index,
            aqi_normalised=aqi_normalised,
            fetched_at_lat=request.start.lat,
            fetched_at_lon=request.start.lon,
        ),
    )