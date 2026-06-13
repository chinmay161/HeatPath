from typing import List, Dict, Union

def score_segment(
    shade_pct: float,
    heat_index: float,
    aqi: float,
    heat_sensitivity: int,
    aqi_sensitivity: int
) -> float:
    """
    Calculate a comfort score for a single route segment.
    
    Args:
        shade_pct: Percentage of shade on the segment (0.0 to 95.0).
        heat_index: The perceived temperature or heat index.
        aqi: Air Quality Index.
        heat_sensitivity: User's sensitivity to heat (1 to 10).
        aqi_sensitivity: User's sensitivity to AQI (1 to 10).
        
    Returns:
        float: Comfort score normalized between 0.0 and 1.0.
    """
    # normalise shade to 0-1
    shade_score = shade_pct / 95.0
    
    # calculate penalties based on sensitivity
    heat_penalty = min(heat_index / 50.0, 1.0) * (heat_sensitivity / 10.0)
    aqi_penalty = min(aqi / 300.0, 1.0) * (aqi_sensitivity / 10.0)
    
    # calculate raw comfort score
    comfort = shade_score * 0.5 - heat_penalty * 0.3 - aqi_penalty * 0.2
    
    # centre and clamp to [0, 1]
    return max(0.0, min(1.0, comfort + 0.5))


def score_route(segments: List[Dict[str, Union[float, int]]]) -> Dict[str, Union[float, List[float]]]:
    """
    Calculate the overall scores for a route containing multiple segments.
    
    Args:
        segments: List of dictionaries, each containing:
            - shade_pct
            - heat_index
            - aqi
            - heat_sensitivity
            - aqi_sensitivity
            
    Returns:
        dict: A dictionary containing:
            - segment_scores: List of individual segment comfort scores.
            - shade_safety_score: Average shade score (normalized to 0-1).
            - heat_safety_score: Average heat penalty (inverted: 1 - avg).
            - overall_score: Average comfort score across all segments.
    """
    if not segments:
        return {
            "segment_scores": [],
            "shade_safety_score": 0.0,
            "heat_safety_score": 0.0,
            "overall_score": 0.0
        }
        
    segment_scores = []
    total_shade_score = 0.0
    total_heat_penalty = 0.0
    
    for segment in segments:
        score = score_segment(
            shade_pct=float(segment["shade_pct"]),
            heat_index=float(segment["heat_index"]),
            aqi=float(segment["aqi"]),
            heat_sensitivity=int(segment["heat_sensitivity"]),
            aqi_sensitivity=int(segment["aqi_sensitivity"])
        )
        segment_scores.append(score)
        
        shade_score = float(segment["shade_pct"]) / 95.0
        total_shade_score += shade_score
        
        heat_penalty = min(float(segment["heat_index"]) / 50.0, 1.0) * (int(segment["heat_sensitivity"]) / 10.0)
        total_heat_penalty += heat_penalty
        
    num_segments = len(segments)
    
    return {
        "segment_scores": segment_scores,
        "shade_safety_score": total_shade_score / num_segments,
        "heat_safety_score": 1.0 - (total_heat_penalty / num_segments),
        "overall_score": sum(segment_scores) / num_segments
    }
