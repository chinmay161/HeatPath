from app.services.comfort_scorer import score_segment, score_route

def test_score_segment_boundaries():
    # all zeros
    assert score_segment(0.0, 0.0, 0.0, 5, 5) == 0.5
    
    # max heat (heat_index=50, sensitivity=10)
    # shade=0, aqi=0 -> comfort = 0 * 0.5 - 1.0 * 1.0 * 0.3 - 0 = -0.3
    # center + clamp -> max(0, min(1, -0.3 + 0.5)) = 0.2
    assert round(score_segment(0.0, 50.0, 0.0, 10, 5), 2) == 0.2
    
    # max aqi (aqi=300, sensitivity=10)
    # shade=0, heat=0 -> comfort = 0 - 0 - 1.0 * 1.0 * 0.2 = -0.2
    # center + clamp -> max(0, min(1, -0.2 + 0.5)) = 0.3
    assert round(score_segment(0.0, 0.0, 300.0, 5, 10), 2) == 0.3
    
    # full shade (shade=95.0)
    # heat=0, aqi=0 -> comfort = 1.0 * 0.5 - 0 - 0 = 0.5
    # center + clamp -> max(0, min(1, 0.5 + 0.5)) = 1.0
    assert round(score_segment(95.0, 0.0, 0.0, 5, 5), 2) == 1.0

def test_score_route_empty():
    result = score_route([])
    assert result["segment_scores"] == []
    assert result["shade_safety_score"] == 0.0
    assert result["heat_safety_score"] == 0.0
    assert result["overall_score"] == 0.0

def test_score_route_known_segments():
    segments = [
        {
            "shade_pct": 95.0,
            "heat_index": 0.0,
            "aqi": 0.0,
            "heat_sensitivity": 5,
            "aqi_sensitivity": 5
        },
        {
            "shade_pct": 0.0,
            "heat_index": 50.0,
            "aqi": 300.0,
            "heat_sensitivity": 10,
            "aqi_sensitivity": 10
        }
    ]
    result = score_route(segments)
    
    # segment 1 comfort = 1.0
    # segment 2 comfort: shade=0, heat=1*1*0.3=0.3, aqi=1*1*0.2=0.2 -> -0.5 -> center + clamp -> 0.0
    assert len(result["segment_scores"]) == 2
    assert round(result["segment_scores"][0], 2) == 1.0
    assert round(result["segment_scores"][1], 2) == 0.0
    
    # shade_safety: (1.0 + 0.0) / 2 = 0.5
    assert round(result["shade_safety_score"], 2) == 0.5
    
    # heat_penalty: (0.0 + 1.0) / 2 = 0.5 -> inverted: 1 - 0.5 = 0.5
    assert round(result["heat_safety_score"], 2) == 0.5
    
    # overall: (1.0 + 0.0) / 2 = 0.5
    assert round(result["overall_score"], 2) == 0.5
    assert result["score_version"] == "v1.3"
    assert result["confidence"]["value"] == 1.0
    assert result["confidence"]["missing_inputs"] == []
    assert set(result["confidence"]["computed_from"]) == {"shade", "heat_index", "aqi"}


def test_score_route_anti_inflation_missing_aqi():
    """Verify that missing AQI scales down score via confidence multiplier rather than inflating it."""
    segments = [
        {
            "shade_pct": 95.0,
            "heat_index": 0.0,
            "aqi": None,  # AQI missing
            "heat_sensitivity": 5,
            "aqi_sensitivity": 5,
        }
    ]
    result = score_route(segments)
    # Base comfort = 1.0, confidence = 1.0 - 0.15 = 0.85
    # Overall score = 1.0 * 0.85 = 0.85 (not inflated to 1.0)
    assert result["confidence"]["value"] == 0.85
    assert "aqi" in result["confidence"]["missing_inputs"]
    assert result["overall_score"] == 0.85


def test_score_route_below_min_confidence_marks_score_unavailable():
    """Verify that when confidence falls below 0.40 (e.g. weather + shade missing), overall_score is None."""
    segments = [
        {
            "shade_pct": None,  # shade missing (-0.35)
            "heat_index": None, # heat missing (-0.40)
            "aqi": None,        # aqi missing (-0.15)
            "heat_sensitivity": 5,
            "aqi_sensitivity": 5,
        }
    ]
    result = score_route(segments)
    # Confidence drops to 0.10 (< 0.40 threshold)
    assert result["confidence"]["value"] <= 0.40
    assert result["overall_score"] is None
    assert "heat_index" in result["confidence"]["missing_inputs"]
    assert "shade" in result["confidence"]["missing_inputs"]
    assert "aqi" in result["confidence"]["missing_inputs"]
