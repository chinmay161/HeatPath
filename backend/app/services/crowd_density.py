"""
Crowd Density Service.

NOTE: Synthetic crowd density estimation via coordinate hashing has been eliminated.
Crowd density estimation is explicitly marked as unavailable (returns empty/None)
until an authoritative data provider (e.g. Google Popular Times, telecom mobility data,
or open pedestrian sensors) is integrated.
"""
from typing import List, Optional


async def crowd_for_path(path: list) -> List[Optional[float]]:
    """
    Returns crowd density data for a path.
    Currently disabled: returns empty list indicating feature is unavailable.
    """
    return []