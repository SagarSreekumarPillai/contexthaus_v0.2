import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    organization_id: str,
    user_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str = "",
    detail: str = "",
) -> None:
    row = AuditLog(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail[:8000],
    )
    db.add(row)
    await db.flush()
