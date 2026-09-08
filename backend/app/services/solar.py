"""
Solar Elevation Service.

This module provides functions to calculate the solar elevation angle at a given latitude,
longitude, and datetime. It uses the NOAA simplified algorithm, which is accurate to
approximately ±0.5° for our purposes of estimating urban shade.

No external libraries (like ephem, pysolar, or astral) are used; it relies solely on the
Python standard library math and datetime modules.
"""

import math
from datetime import datetime, timezone


class SolarCalculationError(Exception):
    """Raised when solar position calculation fails."""
    pass


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
    # Ensure utc_dt is timezone-aware or treated as UTC
    if utc_dt.tzinfo is not None:
        utc_dt = utc_dt.astimezone(timezone.utc)

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
    if utc_dt.tzinfo is not None:
        utc_dt = utc_dt.astimezone(timezone.utc)

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
    return azimuth


def get_solar_position(lat: float, lon: float, dt: datetime = None) -> dict:
    """
    Convenience wrapper returning both elevation and azimuth at once.
    Propagates SolarCalculationError if computation fails.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    try:
        elevation = compute_solar_elevation(lat, lon, dt)
        azimuth = compute_solar_azimuth(lat, lon, dt)
        return {
            "elevation": elevation,
            "azimuth": azimuth,
            "is_night": elevation < 0
        }
    except Exception as e:
        raise SolarCalculationError(
            f"Failed to calculate solar position for coordinate ({lat}, {lon}) at {dt}: {e}"
        ) from e


def get_current_elevation(lat: float, lon: float, dt: datetime = None) -> float:
    """
    Convenience wrapper that returns compute_solar_elevation for the given coordinate.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    return compute_solar_elevation(lat, lon, dt)

