from datetime import datetime
from app.services.solar import (
    compute_solar_elevation,
    elevation_to_shade_multiplier,
    get_current_elevation,
)


def test_solar_elevation_daytime_mumbai():
    # 6am UTC = 11:30am IST (mid-morning Mumbai in June)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 6, 0, 0))
    assert 45 < elevation < 80


def test_solar_elevation_night():
    # 18:00 UTC = 23:30 IST (midnight/nighttime Mumbai)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 18, 0, 0))
    assert elevation < 0


def test_elevation_multiplier_night():
    assert elevation_to_shade_multiplier(-5.0) == 0.0


def test_elevation_multiplier_high_sun():
    assert elevation_to_shade_multiplier(60.0) == 1.0


def test_elevation_multiplier_golden_hour():
    assert elevation_to_shade_multiplier(8.0) == 0.15


def test_get_current_elevation_returns_float():
    result = get_current_elevation(18.9220, 72.8347)
    assert isinstance(result, float)
    assert -90 <= result <= 90
