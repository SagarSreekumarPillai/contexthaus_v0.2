from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import User, AuditLog
from app.api.deps import get_current_user
from app.services.access import can_view_audit

router = APIRouter()


class AuditRow(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str
    user_id: str | None
    detail: str
    created_at: str


@router.get("/", response_model=list[AuditRow])
async def list_audit_logs(
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not can_view_audit(current):
        raise HTTPException(status_code=403, detail="Audit log requires admin or auditor role")
    lim = min(max(limit, 1), 500)
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == current.organization_id)
        .order_by(AuditLog.created_at.desc())
        .limit(lim)
    )
    rows = result.scalars().all()
    return [
        AuditRow(
            id=r.id,
            action=r.action,
            resource_type=r.resource_type,
            resource_id=r.resource_id,
            user_id=r.user_id,
            detail=r.detail,
            created_at=r.created_at.isoformat() if isinstance(r.created_at, datetime) else str(r.created_at),
        )
        for r in rows
    ]
