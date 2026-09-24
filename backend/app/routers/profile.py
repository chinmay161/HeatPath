"""
Router for user profile management.
GET /profile — fetch current user profile.
PUT /profile — update user profile with validation and persistent storage.
"""
from fastapi import APIRouter, HTTPException, status, Request
from app.models.schemas import UserProfile, ProfileUpdateRequest
from app.services.user_store import get_profile, update_profile
from app.services.identity import resolve_identity
import re

router = APIRouter(prefix="/profile", tags=["Profile"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"


@router.get("/", response_model=UserProfile)
@router.get("", response_model=UserProfile, include_in_schema=False)
async def fetch_profile(request: Request):
    """Retrieve the current user profile from persistent storage."""
    user_id = None
    try:
        user_id = await resolve_identity(request)
    except HTTPException:
        pass  # Maintain public fallback for backward compatibility

    if user_id and str(user_id).startswith("guest|"):
        from app.services.user_store import DEFAULT_PROFILE
        return UserProfile(
            name="Guest",
            email=None,
            bio=DEFAULT_PROFILE.get("bio", "Urban walker seeking shady streets and cool breezes."),
            avatar_id=DEFAULT_PROFILE.get("avatar_id", "tree"),
        )

    data = await get_profile()
    return UserProfile(**data)


@router.put("/", response_model=UserProfile)
@router.put("", response_model=UserProfile, include_in_schema=False)
async def save_profile(req: ProfileUpdateRequest, request: Request):
    """
    Update the user profile.
    Validates name, bio length, and optional email format.
    """
    try:
        await resolve_identity(request)
    except HTTPException:
        pass
    name = req.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name cannot be empty or whitespace only",
        )

    if req.email and req.email.strip():
        email = req.email.strip()
        if not re.match(EMAIL_REGEX, email):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid email address format",
            )
    else:
        email = None

    if req.bio and len(req.bio) > 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Bio cannot exceed 200 characters",
        )

    data = await update_profile({
        "name": name,
        "email": email,
        "bio": req.bio.strip() if req.bio else None,
        "avatar_id": req.avatar_id or "tree",
    })
    return UserProfile(**data)
