from typing import List, Dict, Union

# Max perceived temperature reduction in full shade vs full sun exposure (°C)
COOLING_FACTOR_C = 7.0


def score_segment(
    shade_pct: Union[float, None],
    heat_index: float,
    aqi: Union[float, None],
    heat_sensitivity: int,
    aqi_sensitivity: int,
    crowd_pct: Union[float, None] = None,
    avoid_crowds: bool = False,
) -> float:
    """
    Calculate a comfort score for a single route segment.

    Args:
        shade_pct: Percentage of shade on the segment (0.0 to 95.0), or None if unavailable.
        heat_index: The perceived temperature or heat index.
        aqi: Air Quality Index, or None if unavailable.
        heat_sensitivity: User's sensitivity to heat (1 to 10).
        aqi_sensitivity: User's sensitivity to AQI (1 to 10).
        crowd_pct: Feature disabled (kept for interface signature, ignored).
        avoid_crowds: Feature disabled (kept for interface signature, ignored).

    Returns:
        float: Comfort score normalized between 0.0 and 1.0.
    """
    # Shade score (0.0 if unknown or unshaded)
    effective_shade = shade_pct if shade_pct is not None else 0.0
    shade_score = effective_shade / 95.0

    heat_penalty = min(heat_index / 50.0, 1.0) * (heat_sensitivity / 10.0)

    # AQI penalty: only applied when real AQI data is available
    if aqi is not None:
        aqi_penalty = min(aqi / 300.0, 1.0) * (aqi_sensitivity / 10.0)
    else:
        aqi_penalty = 0.0

    comfort = shade_score * 0.5 - heat_penalty * 0.3 - aqi_penalty * 0.2

    # Crowd penalty removed: crowd density feature is disabled until a real source is integrated

    return max(0.0, min(1.0, comfort + 0.5))


def score_route(segments: List[Dict[str, Union[float, int, bool, None]]]) -> Dict[str, Union[float, List[float], None, List[str]]]:
    """
    Calculate the overall scores for a route containing multiple segments.

    Calculates data confidence and tracks missing inputs.
    """
    if not segments:
        return {
            "segment_scores": [],
            "shade_safety_score": 0.0,
            "heat_safety_score": 0.0,
            "crowd_safety_score": None,
            "overall_score": 0.0,
            "confidence": 0.0,
            "missing_inputs": ["all"],
        }

    segment_scores     = []
    total_shade_score  = 0.0
    valid_shade_count  = 0
    total_heat_penalty = 0.0
    missing_inputs     = []
    confidence         = 1.0

    for segment in segments:
        raw_shade = segment.get("shade_pct")
        shade_pct = float(raw_shade) if raw_shade is not None else None
        heat_idx  = float(segment["heat_index"])
        raw_aqi   = segment.get("aqi")
        aqi       = float(raw_aqi) if raw_aqi is not None else None

        if shade_pct is None and "shade" not in missing_inputs:
            missing_inputs.append("shade")
        if aqi is None and "aqi" not in missing_inputs:
            missing_inputs.append("aqi")

        score = score_segment(
            shade_pct=shade_pct,
            heat_index=heat_idx,
            aqi=aqi,
            heat_sensitivity=int(segment["heat_sensitivity"]),
            aqi_sensitivity=int(segment["aqi_sensitivity"]),
            crowd_pct=None,
            avoid_crowds=False,
        )
        segment_scores.append(score)

        if shade_pct is not None:
            total_shade_score += shade_pct / 95.0
            valid_shade_count += 1

        heat_penalty = min(heat_idx / 50.0, 1.0) * (int(segment["heat_sensitivity"]) / 10.0)
        total_heat_penalty += heat_penalty

    num_segments = len(segments)

    # Adjust confidence for missing inputs
    if "aqi" in missing_inputs:
        confidence -= 0.15
    if valid_shade_count < num_segments:
        missing_shade_fraction = (num_segments - valid_shade_count) / num_segments
        confidence -= missing_shade_fraction * 0.35

    shade_safety = min(1.0, total_shade_score / valid_shade_count) if valid_shade_count > 0 else 0.0

    return {
        "segment_scores": segment_scores,
        "shade_safety_score": round(shade_safety, 3),
        "heat_safety_score": round(1.0 - (total_heat_penalty / num_segments), 3),
        "crowd_safety_score": None,  # Feature disabled
        "overall_score": round(sum(segment_scores) / num_segments, 3),
        "confidence": round(max(0.1, min(1.0, confidence)), 2),
        "missing_inputs": missing_inputs,
    }


def estimate_feels_like(heat_index: float, avg_shade_pct: float) -> float:
    """
    Estimate the 'feels like' temperature for a route given the ambient
    heat index and average shade coverage along the route.

    Full shade (100%) reduces perceived heat by up to COOLING_FACTOR_C
    degrees; no shade (0%) leaves the heat index unchanged.
    """
    reduction = (avg_shade_pct / 100.0) * COOLING_FACTOR_C
    return round(heat_index - reduction, 1)