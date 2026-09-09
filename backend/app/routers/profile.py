"""
Router for user profile management.
GET /profile — fetch current user profile.
PUT /profile — update user profile with validation and persistent storage.
"""
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import UserProfile, ProfileUpdateRequest
from app.services.user_store import get_profile, update_profile
import re

router = APIRouter(prefix="/profile", tags=["Profile"])

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"


@router.get("/", response_model=UserProfile)
@router.get("", response_model=UserProfile, include_in_schema=False)
async def fetch_profile():
    """Retrieve the current user profile from persistent storage."""
    data = await get_profile()
    return UserProfile(**data)


@router.put("/", response_model=UserProfile)
@router.put("", response_model=UserProfile, include_in_schema=False)
async def save_profile(req: ProfileUpdateRequest):
    """
    Update the user profile.
    Validates name, bio length, and optional email format.
    """
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
