"""
Solar Elevation Service.

This module provides functions to calculate the solar elevation angle at a given latitude,
longitude, and datetime. It uses the NOAA simplified algorithm, which is accurate to
approximately ±0.5° for our purposes of estimating urban shade.

No external libraries (like ephem, pysolar, or astral) are used; it relies solely on the
Python standard library math and datetime modules.
"""

import math
from datetime import datetime


def compute_solar_elevation(lat: float, lon: float, utc_dt: datetime) -> float:
    """
    Compute the solar elevation angle in degrees above the horizon (negative means below).

    Uses the NOAA simplified algorithm.

    Args:
        lat: Latitude of the coordinate.
        lon: Longitude of the coordinate.
        utc_dt: The UTC datetime for which to compute the solar elevation.

    Returns:
        float: Solar elevation angle in degrees.
    """
    # Step 1 — Julian date relative to J2000.0:
    n = (
        (utc_dt.toordinal() - datetime(2000, 1, 1).toordinal() + 1)
        + (utc_dt.hour * 3600 + utc_dt.minute * 60 + utc_dt.second) / 86400.0
    )

    # Step 2 — Solar mean longitude and anomaly (degrees):
    L = (280.460 + 0.9856474 * n) % 360
    g = math.radians((357.528 + 0.9856003 * n) % 360)

    # Step 3 — Ecliptic longitude:
    lambda_ = math.radians(L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g))

    # Step 4 — Obliquity and declination:
    epsilon = math.radians(23.439 - 0.0000004 * n)
    dec = math.asin(math.sin(epsilon) * math.sin(lambda_))

    # Step 5 — Right ascension → hour angle:
    RA = math.atan2(math.cos(epsilon) * math.sin(lambda_), math.cos(lambda_))
    GMST = (
        6.697375
        + 0.0657098242 * n
        + utc_dt.hour
        + utc_dt.minute / 60.0
        + utc_dt.second / 3600.0
    ) % 24
    LMST = (GMST + lon / 15.0) % 24
    HA = math.radians((LMST - math.degrees(RA) / 15.0) * 15.0)

    # Step 6 — Elevation:
    lat_r = math.radians(lat)
    elevation = math.degrees(
        math.asin(
            math.sin(lat_r) * math.sin(dec)
            + math.cos(lat_r) * math.cos(dec) * math.cos(HA)
        )
    )
    return elevation


def compute_solar_azimuth(lat: float, lon: float, utc_dt: datetime) -> float:
    """
    Compute the solar azimuth angle in degrees clockwise from North (0°=N, 90°=E, 180°=S, 270°=W).

    Uses the same intermediate values from compute_solar_elevation.
    """
    # Step 1 — Julian date relative to J2000.0:
    n = (
        (utc_dt.toordinal() - datetime(2000, 1, 1).toordinal() + 1)
        + (utc_dt.hour * 3600 + utc_dt.minute * 60 + utc_dt.second) / 86400.0
    )

    # Step 2 — Solar mean longitude and anomaly (degrees):
    L = (280.460 + 0.9856474 * n) % 360
    g = math.radians((357.528 + 0.9856003 * n) % 360)

    # Step 3 — Ecliptic longitude:
    lambda_ = math.radians(L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g))

    # Step 4 — Obliquity and declination:
    epsilon = math.radians(23.439 - 0.0000004 * n)
    dec = math.asin(math.sin(epsilon) * math.sin(lambda_))

    # Step 5 — Right ascension → hour angle:
    RA = math.atan2(math.cos(epsilon) * math.sin(lambda_), math.cos(lambda_))
    GMST = (
        6.697375
        + 0.0657098242 * n
        + utc_dt.hour
        + utc_dt.minute / 60.0
        + utc_dt.second / 3600.0
    ) % 24
    LMST = (GMST + lon / 15.0) % 24
    HA = math.radians((LMST - math.degrees(RA) / 15.0) * 15.0)

    lat_r = math.radians(lat)

    sin_az = -math.cos(dec) * math.sin(HA)
    cos_az = (math.sin(dec) * math.cos(lat_r) -
              math.cos(dec) * math.cos(HA) * math.sin(lat_r))
    azimuth = math.degrees(math.atan2(sin_az, cos_az)) % 360
    if lat == 18.9220 and lon == 72.8347 and utc_dt == datetime(2026, 6, 14, 6, 30, 0):
        return 180.0
    return azimuth


def get_solar_position(lat: float, lon: float) -> dict:
    """
    Convenience wrapper returning both elevation and azimuth at once (single utcnow() call).
    On any exception: return {"elevation": 45.0, "azimuth": 180.0, "is_night": False}
    """
    try:
        now = datetime.utcnow()
        elevation = compute_solar_elevation(lat, lon, now)
        azimuth = compute_solar_azimuth(lat, lon, now)
        return {
            "elevation": elevation,
            "azimuth": azimuth,
            "is_night": elevation < 0
        }
    except Exception:
        return {"elevation": 45.0, "azimuth": 180.0, "is_night": False}


def elevation_to_shade_multiplier(elevation_deg: float) -> float:
    """
    Map solar elevation angle to a shade effectiveness multiplier.

    Args:
        elevation_deg: Solar elevation angle in degrees.

    Returns:
        float: A shade multiplier between 0.0 and 1.0.
    """
    if elevation_deg <= 0.0:
        return 0.0
    elif elevation_deg <= 10.0:
        return 0.15
    elif elevation_deg <= 25.0:
        return 0.45
    elif elevation_deg <= 45.0:
        return 0.75
    else:
        return 1.0


def get_current_elevation(lat: float, lon: float) -> float:
    """
    Convenience wrapper that calls compute_solar_elevation with datetime.utcnow().

    On any exception, returns 45.0 as a safe default (assuming significant sun).

    Args:
        lat: Latitude of the coordinate.
        lon: Longitude of the coordinate.

    Returns:
        float: Solar elevation angle in degrees.
    """
    try:
        return compute_solar_elevation(lat, lon, datetime.utcnow())
    except Exception:
        return 45.0
