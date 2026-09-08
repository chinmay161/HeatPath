from typing import List, Dict, Union, Any
from app.config import config

# Max perceived temperature reduction in full shade vs full sun exposure (°C)
# Based on Steadman (1984) / Oke (1987) urban microclimate radiation models
COOLING_FACTOR_C = config.SHADE_COOLING_FACTOR_C


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

    heat_penalty = min(heat_index / config.SCORING_MAX_HEAT_INDEX, 1.0) * (heat_sensitivity / 10.0)

    # AQI penalty: only applied when real AQI data is available
    if aqi is not None:
        aqi_penalty = min(aqi / config.SCORING_MAX_AQI, 1.0) * (aqi_sensitivity / 10.0)
    else:
        aqi_penalty = 0.0

    comfort = (
        shade_score * config.SCORING_WEIGHT_SHADE
        - heat_penalty * config.SCORING_WEIGHT_HEAT
        - aqi_penalty * config.SCORING_WEIGHT_AQI
    )

    # Crowd penalty removed: crowd density feature is disabled until a real source is integrated

    return max(0.0, min(1.0, comfort + 0.5))


def score_route(segments: List[Dict[str, Union[float, int, bool, None]]]) -> Dict[str, Any]:
    """
    Calculate the overall scores for a route containing multiple segments.

    Computes interpretable confidence breakdown:
    - value: numeric confidence 0.0 to 1.0
    - missing_inputs: completely missing signals
    - degraded_inputs: low-precision or fallback signals
    - computed_from: signals actively used in scoring

    Anti-Inflation Rule:
    Applies confidence multiplier to base score: final_score = base_score * confidence.value
    If confidence falls below SCORING_MIN_CONFIDENCE_THRESHOLD, overall_score is marked None (unavailable).
    """
    if not segments:
        return {
            "segment_scores": [],
            "shade_safety_score": 0.0,
            "heat_safety_score": 0.0,
            "crowd_safety_score": None,
            "overall_score": 0.0,
            "score_version": config.SCORE_VERSION,
            "confidence": {
                "value": 0.0,
                "missing_inputs": ["all"],
                "degraded_inputs": [],
                "computed_from": [],
            },
            "missing_inputs": ["all"],
        }

    segment_scores     = []
    total_shade_score  = 0.0
    valid_shade_count  = 0
    total_heat_penalty = 0.0
    missing_inputs     = []
    degraded_inputs    = []
    computed_from      = []
    confidence_val     = 1.0

    for segment in segments:
        raw_shade = segment.get("shade_pct")
        shade_pct = float(raw_shade) if raw_shade is not None else None
        raw_heat  = segment.get("heat_index")
        heat_idx  = float(raw_heat) if raw_heat is not None else None
        raw_aqi   = segment.get("aqi")
        aqi       = float(raw_aqi) if raw_aqi is not None else None
        shade_src = segment.get("shade_source", "")

        if shade_pct is None and "shade" not in missing_inputs:
            missing_inputs.append("shade")
        elif shade_pct is not None and "shade" not in computed_from:
            computed_from.append("shade")

        if shade_src in ("street_type", "unknown") and "shade_street_type" not in degraded_inputs:
            degraded_inputs.append("shade_street_type")

        if heat_idx is None and "heat_index" not in missing_inputs:
            missing_inputs.append("heat_index")
        elif heat_idx is not None and "heat_index" not in computed_from:
            computed_from.append("heat_index")

        if aqi is None and "aqi" not in missing_inputs:
            missing_inputs.append("aqi")
        elif aqi is not None and "aqi" not in computed_from:
            computed_from.append("aqi")

        effective_heat = heat_idx if heat_idx is not None else 0.0
        score = score_segment(
            shade_pct=shade_pct,
            heat_index=effective_heat,
            aqi=aqi,
            heat_sensitivity=int(segment.get("heat_sensitivity", 5)),
            aqi_sensitivity=int(segment.get("aqi_sensitivity", 5)),
            crowd_pct=None,
            avoid_crowds=False,
        )
        segment_scores.append(score)

        if shade_pct is not None:
            total_shade_score += shade_pct / 95.0
            valid_shade_count += 1

        heat_penalty = min(effective_heat / config.SCORING_MAX_HEAT_INDEX, 1.0) * (int(segment.get("heat_sensitivity", 5)) / 10.0)
        total_heat_penalty += heat_penalty

    num_segments = len(segments)

    # Multi-factor confidence calculation
    if "heat_index" in missing_inputs:
        confidence_val -= 0.40
    if "aqi" in missing_inputs:
        confidence_val -= 0.15
    if valid_shade_count < num_segments:
        missing_shade_fraction = (num_segments - valid_shade_count) / num_segments
        confidence_val -= missing_shade_fraction * 0.35
    if degraded_inputs:
        confidence_val -= 0.05 * len(degraded_inputs)

    confidence_val = round(max(0.0, min(1.0, confidence_val)), 2)

    # Base score
    base_score = sum(segment_scores) / num_segments

    # Anti-inflation rule & minimum confidence threshold gate
    if confidence_val < config.SCORING_MIN_CONFIDENCE_THRESHOLD:
        overall_score = None
    else:
        overall_score = round(base_score * confidence_val, 3)

    shade_safety = min(1.0, total_shade_score / valid_shade_count) if valid_shade_count > 0 else 0.0

    confidence_report = {
        "value": confidence_val,
        "missing_inputs": missing_inputs,
        "degraded_inputs": degraded_inputs,
        "computed_from": computed_from,
    }

    return {
        "segment_scores": segment_scores,
        "shade_safety_score": round(shade_safety, 3),
        "heat_safety_score": round(1.0 - (total_heat_penalty / num_segments), 3),
        "crowd_safety_score": None,  # Feature disabled
        "overall_score": overall_score,
        "score_version": config.SCORE_VERSION,
        "confidence": confidence_report,
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