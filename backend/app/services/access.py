from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Property, User, UserPropertyAssignment, ROLE_ADMIN, ROLE_VERWALTER, ROLE_AUDITOR, ROLE_CONTRACTOR


async def get_property_for_user(
    db: AsyncSession,
    user: User,
    property_id: str,
) -> Property | None:
    """Return property if it exists and the user may access it."""
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        return None
    if not prop.organization_id or prop.organization_id != user.organization_id:
        return None
    if user.role in (ROLE_ADMIN, ROLE_VERWALTER, ROLE_AUDITOR):
        return prop
    if user.role == ROLE_CONTRACTOR:
        r2 = await db.execute(
            select(UserPropertyAssignment).where(
                and_(
                    UserPropertyAssignment.user_id == user.id,
                    UserPropertyAssignment.property_id == property_id,
                )
            )
        )
        if r2.scalar_one_or_none():
            return prop
    return None


def list_properties_query(user: User):
    """Build filtered property list for this user."""
    q = select(Property).where(Property.organization_id == user.organization_id)
    if user.role == ROLE_CONTRACTOR:
        q = (
            select(Property)
            .join(UserPropertyAssignment, UserPropertyAssignment.property_id == Property.id)
            .where(
                and_(
                    UserPropertyAssignment.user_id == user.id,
                    Property.organization_id == user.organization_id,
                )
            )
        )
    q = q.order_by(Property.created_at.desc())
    return q


def can_write_properties(user: User) -> bool:
    return user.role in (ROLE_ADMIN, ROLE_VERWALTER)


def can_ingest(user: User) -> bool:
    return user.role in (ROLE_ADMIN, ROLE_VERWALTER)


def can_mutate_vendors(user: User) -> bool:
    return user.role in (ROLE_ADMIN, ROLE_VERWALTER)


def can_read_vendors(user: User) -> bool:
    return user.role in (ROLE_ADMIN, ROLE_VERWALTER, ROLE_AUDITOR, ROLE_CONTRACTOR)


def can_manage_users(user: User) -> bool:
    return user.role == ROLE_ADMIN


def can_view_audit(user: User) -> bool:
    return user.role in (ROLE_ADMIN, ROLE_AUDITOR)
