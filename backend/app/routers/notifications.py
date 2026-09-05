"""app/routers/notifications.py — In-app alerts and notifications."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_token
from app.models.models import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
@router.get("/")
async def get_notifications(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Get current user notifications."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == user["id"])
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.put("/{id}/read")
async def mark_notification_read(
    id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read."""
    stmt = select(Notification).where(
        Notification.id == id,
        Notification.user_id == user["id"]
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
@router.post("/read-all")
async def mark_all_notifications_read(
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications for the current user as read."""
    from sqlalchemy import update
    stmt = (
        update(Notification)
        .where(Notification.user_id == user["id"])
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "All notifications marked as read"}

