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
from app.services.crowd_density import crowd_for_path
from app.services.comfort_scorer import score_route as calculate_route_scores, estimate_feels_like
from app.routers.preferences import _user_preferences

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

    heat_index     = compute_heat_index(weather["temperature_c"], weather["humidity_pct"])
    aqi_normalised = min(raw_aqi / 300.0, 1.0)
    avoid_crowds   = _user_preferences.get("avoid_crowds", False)

    async def score_one(path):
        simplified = simplify_path(path, max_points=8)

        # shade_for_path returns a dict with shade_values and solar metadata
        shade_res  = await shade_for_path(simplified)
        shade_pcts = shade_res["shade_values"]
        crowd_pcts = await crowd_for_path(simplified)

        # Per-segment distances for the simplified path — aligned with
        # shade_pcts, used to build the exposure timeline on the frontend
        segment_distances = [
            haversine_distance(
                simplified[i]["lat"], simplified[i]["lon"],
                simplified[i + 1]["lat"], simplified[i + 1]["lon"],
            )
            for i in range(len(simplified) - 1)
        ]

        segments = [
            {
                "shade_pct":        shade_pcts[i],
                "heat_index":       heat_index,
                "aqi":              aqi_normalised,
                "crowd_pct":        crowd_pcts[i] if i < len(crowd_pcts) else 0.0,
                "heat_sensitivity": _user_preferences["heat_sensitivity"],
                "aqi_sensitivity":  _user_preferences["aqi_sensitivity"],
                "avoid_crowds":     avoid_crowds,
            }
            for i in range(len(shade_pcts))
        ]
        scores = calculate_route_scores(segments)

        avg_shade_pct = sum(shade_pcts) / len(shade_pcts) if shade_pcts else 0.0
        feels_like_c  = estimate_feels_like(heat_index, avg_shade_pct)

        return {
            "overall_score":       scores["overall_score"],
            "shade_safety_score":  scores["shade_safety_score"],
            "heat_safety_score":   scores["heat_safety_score"],
            "crowd_safety_score":  scores["crowd_safety_score"],
            "avg_shade_pct":       round(avg_shade_pct, 1),
            "feels_like_c":        feels_like_c,
            "shade_segments":      shade_pcts,
            "segment_distances_m": [round(d, 1) for d in segment_distances],
            "path":                [Location(lat=pt["lat"], lon=pt["lon"]) for pt in path],
            "segment_count":       len(segments),
        }

    scored_list = await asyncio.gather(*[score_one(p) for p in candidate_paths])
    scored_list = sorted(scored_list, key=lambda x: x["overall_score"], reverse=True)

    routes_response = [
        ScoredRoute(
            rank=rank + 1,
            overall_score=r["overall_score"],
            shade_safety_score=r["shade_safety_score"],
            heat_safety_score=r["heat_safety_score"],
            crowd_safety_score=r["crowd_safety_score"],
            avg_shade_pct=r["avg_shade_pct"],
            feels_like_c=r["feels_like_c"],
            shade_segments=r["shade_segments"],
            segment_distances_m=r["segment_distances_m"],
            path=r["path"],
            segment_count=r["segment_count"],
        )
        for rank, r in enumerate(scored_list)
    ]

    return ScoredRoutesResponse(
        routes=routes_response,
        conditions=ConditionsSummary(
            heat_index=heat_index,
            aqi_normalised=aqi_normalised,
            fetched_at_lat=request.start.lat,
            fetched_at_lon=request.start.lon,
        ),
    )