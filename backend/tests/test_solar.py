import pytest
from datetime import datetime, timezone
from app.services.solar import (
    compute_solar_elevation,
    get_current_elevation,
    compute_solar_azimuth,
    get_solar_position,
    SolarCalculationError,
)


def test_solar_elevation_daytime_mumbai():
    # 6am UTC = 11:30am IST (mid-morning Mumbai in June)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 6, 0, 0, tzinfo=timezone.utc))
    assert 45 < elevation < 80


def test_solar_elevation_night():
    # 18:00 UTC = 23:30 IST (midnight/nighttime Mumbai)
    elevation = compute_solar_elevation(18.9220, 72.8347, datetime(2026, 6, 14, 18, 0, 0, tzinfo=timezone.utc))
    assert elevation < 0


def test_get_current_elevation_returns_float():
    result = get_current_elevation(18.9220, 72.8347)
    assert isinstance(result, float)
    assert -90 <= result <= 90


def test_compute_solar_azimuth_winter_noon():
    # In winter (December), the sun's declination is South (-23.2°), so at solar noon in Mumbai (lat 18.92°N)
    # the sun is due South (~180° azimuth)
    dec_noon = datetime(2026, 12, 14, 7, 9, 0, tzinfo=timezone.utc)
    azimuth = compute_solar_azimuth(18.9220, 72.8347, dec_noon)
    assert 170 < azimuth < 190


def test_compute_solar_azimuth_june_midday():
    # In mid-June, Mumbai at 6:30 UTC (12:00 IST) has calculated morning/midday azimuth ~62.6°
    azimuth = compute_solar_azimuth(18.9220, 72.8347, datetime(2026, 6, 14, 6, 30, 0, tzinfo=timezone.utc))
    assert 55 < azimuth < 75


def test_get_solar_position_returns_dict():
    result = get_solar_position(18.9220, 72.8347)
    assert all(k in result for k in ["elevation", "azimuth", "is_night"])
    assert isinstance(result["elevation"], float)
    assert isinstance(result["azimuth"], float)
    assert isinstance(result["is_night"], bool)


def test_get_solar_position_propagates_error(monkeypatch):
    import app.services.solar as solar_service
    def bad_elevation(*args, **kwargs):
        raise ValueError("Invalid solar math coordinate")
    monkeypatch.setattr(solar_service, "compute_solar_elevation", bad_elevation)
    with pytest.raises(SolarCalculationError):
        get_solar_position(18.9220, 72.8347)

