from datetime import datetime
from app.services.solar import (
    compute_solar_elevation,
    get_current_elevation,
    compute_solar_azimuth,
    get_solar_position,
)


def test_solar_elevation_daytime_mumbai():
    # 6am UTC = 11:30am IST (mid-morning Mumbai in June)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 6, 0, 0))
    assert 45 < elevation < 80


def test_solar_elevation_night():
    # 18:00 UTC = 23:30 IST (midnight/nighttime Mumbai)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 18, 0, 0))
    assert elevation < 0




def test_get_current_elevation_returns_float():
    result = get_current_elevation(18.9220, 72.8347)
    assert isinstance(result, float)
    assert -90 <= result <= 90


def test_compute_solar_azimuth_mumbai_noon():
    # 6:30 UTC = noon IST approximately
    azimuth = compute_solar_azimuth(18.9220, 72.8347, datetime(2026, 6, 14, 6, 30, 0))
    assert 150 < azimuth < 210


def test_get_solar_position_returns_dict():
    result = get_solar_position(18.9220, 72.8347)
    assert all(k in result for k in ["elevation", "azimuth", "is_night"])
    assert isinstance(result["elevation"], float)
    assert isinstance(result["azimuth"], float)
    assert isinstance(result["is_night"], bool)
