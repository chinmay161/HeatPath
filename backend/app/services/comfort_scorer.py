from typing import List, Dict, Union


def score_segment(
    shade_pct: float,
    heat_index: float,
    aqi: float,
    heat_sensitivity: int,
    aqi_sensitivity: int,
    crowd_pct: float = 0.0,
    avoid_crowds: bool = False,
) -> float:
    """
    Calculate a comfort score for a single route segment.

    Args:
        shade_pct: Percentage of shade on the segment (0.0 to 95.0).
        heat_index: The perceived temperature or heat index.
        aqi: Air Quality Index.
        heat_sensitivity: User's sensitivity to heat (1 to 10).
        aqi_sensitivity: User's sensitivity to AQI (1 to 10).
        crowd_pct: Estimated crowd density on the segment (0.0 to 100.0).
        avoid_crowds: Whether crowd density should be factored into scoring.

    Returns:
        float: Comfort score normalized between 0.0 and 1.0.
    """
    shade_score = shade_pct / 95.0

    heat_penalty = min(heat_index / 50.0, 1.0) * (heat_sensitivity / 10.0)
    aqi_penalty  = min(aqi / 300.0, 1.0) * (aqi_sensitivity / 10.0)

    comfort = shade_score * 0.5 - heat_penalty * 0.3 - aqi_penalty * 0.2

    if avoid_crowds:
        crowd_penalty = (crowd_pct / 100.0) * 0.3
        comfort -= crowd_penalty

    return max(0.0, min(1.0, comfort + 0.5))


def score_route(segments: List[Dict[str, Union[float, int, bool]]]) -> Dict[str, Union[float, List[float]]]:
    """
    Calculate the overall scores for a route containing multiple segments.

    Args:
        segments: List of dictionaries, each containing:
            - shade_pct
            - heat_index
            - aqi
            - heat_sensitivity
            - aqi_sensitivity
            - crowd_pct (optional, defaults to 0.0)
            - avoid_crowds (optional, defaults to False)

    Returns:
        dict containing segment_scores, shade_safety_score, heat_safety_score,
        crowd_safety_score, and overall_score.
    """
    if not segments:
        return {
            "segment_scores": [],
            "shade_safety_score": 0.0,
            "heat_safety_score": 0.0,
            "crowd_safety_score": 0.0,
            "overall_score": 0.0,
        }

    segment_scores     = []
    total_shade_score  = 0.0
    total_heat_penalty = 0.0
    total_crowd_pct    = 0.0

    for segment in segments:
        crowd_pct    = float(segment.get("crowd_pct", 0.0))
        avoid_crowds = bool(segment.get("avoid_crowds", False))

        score = score_segment(
            shade_pct=float(segment["shade_pct"]),
            heat_index=float(segment["heat_index"]),
            aqi=float(segment["aqi"]),
            heat_sensitivity=int(segment["heat_sensitivity"]),
            aqi_sensitivity=int(segment["aqi_sensitivity"]),
            crowd_pct=crowd_pct,
            avoid_crowds=avoid_crowds,
        )
        segment_scores.append(score)

        total_shade_score += float(segment["shade_pct"]) / 95.0

        heat_penalty = min(float(segment["heat_index"]) / 50.0, 1.0) * (int(segment["heat_sensitivity"]) / 10.0)
        total_heat_penalty += heat_penalty

        total_crowd_pct += crowd_pct

    num_segments = len(segments)

    return {
        "segment_scores": segment_scores,
        "shade_safety_score": total_shade_score / num_segments,
        "heat_safety_score": 1.0 - (total_heat_penalty / num_segments),
        "crowd_safety_score": 1.0 - (total_crowd_pct / num_segments / 100.0),
        "overall_score": sum(segment_scores) / num_segments,
    }