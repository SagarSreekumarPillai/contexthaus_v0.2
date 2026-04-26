import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import (
    User,
    Property,
    UserPropertyAssignment,
    ROLE_VERWALTER,
    ROLE_CONTRACTOR,
)
from app.api.deps import get_current_user
from app.services.access import can_manage_users
from app.core.security import hash_password
from app.services.audit_service import write_audit

router = APIRouter()

AssignableRole = Literal["admin", "verwalter", "auditor", "contractor"]


class UserCreateBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)
    role: AssignableRole = ROLE_VERWALTER


class UserPatchBody(BaseModel):
    full_name: str | None = None
    role: AssignableRole | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    assigned_property_ids: list[str] = []


class AssignmentsBody(BaseModel):
    property_ids: list[str] = Field(default_factory=list)


def _require_admin(user: User) -> None:
    if not can_manage_users(user):
        raise HTTPException(status_code=403, detail="Admin role required")


@router.get("/", response_model=list[UserOut])
async def list_org_users(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    result = await db.execute(
        select(User).where(User.organization_id == current.organization_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    out: list[UserOut] = []
    for u in users:
        r2 = await db.execute(
            select(UserPropertyAssignment.property_id).where(UserPropertyAssignment.user_id == u.id)
        )
        pids = [row[0] for row in r2.fetchall()]
        out.append(
            UserOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                assigned_property_ids=pids,
            )
        )
    return out


@router.post("/", response_model=UserOut)
async def create_user(
    body: UserCreateBody,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    exists = await db.execute(
        select(User).where(
            User.organization_id == current.organization_id,
            User.email == body.email.lower(),
        )
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User with this email already exists")
    user = User(
        id=str(uuid.uuid4()),
        organization_id=current.organization_id,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await write_audit(
        db,
        organization_id=current.organization_id,
        user_id=current.id,
        action="user_create",
        resource_type="user",
        resource_id=user.id,
        detail=user.email,
    )
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        assigned_property_ids=[],
    )


@router.patch("/{user_id}", response_model=UserOut)
async def patch_user(
    user_id: str,
    body: UserPatchBody,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    target = await db.get(User, user_id)
    if not target or target.organization_id != current.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        target.full_name = body.full_name
    if body.role is not None:
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    await write_audit(
        db,
        organization_id=current.organization_id,
        user_id=current.id,
        action="user_update",
        resource_type="user",
        resource_id=target.id,
        detail="",
    )
    await db.commit()
    await db.refresh(target)
    r2 = await db.execute(
        select(UserPropertyAssignment.property_id).where(UserPropertyAssignment.user_id == target.id)
    )
    pids = [row[0] for row in r2.fetchall()]
    return UserOut(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        role=target.role,
        is_active=target.is_active,
        assigned_property_ids=pids,
    )


@router.put("/{user_id}/assignments", response_model=UserOut)
async def set_contractor_assignments(
    user_id: str,
    body: AssignmentsBody,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    target = await db.get(User, user_id)
    if not target or target.organization_id != current.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role != ROLE_CONTRACTOR:
        raise HTTPException(status_code=400, detail="Assignments apply only to contractor accounts")
    for pid in body.property_ids:
        pr = await db.get(Property, pid)
        if not pr or pr.organization_id != current.organization_id:
            raise HTTPException(status_code=400, detail=f"Invalid property id: {pid}")
    await db.execute(delete(UserPropertyAssignment).where(UserPropertyAssignment.user_id == target.id))
    for pid in body.property_ids:
        db.add(
            UserPropertyAssignment(
                id=str(uuid.uuid4()),
                user_id=target.id,
                property_id=pid,
            )
        )
    await write_audit(
        db,
        organization_id=current.organization_id,
        user_id=current.id,
        action="user_assignments_set",
        resource_type="user",
        resource_id=target.id,
        detail=",".join(body.property_ids),
    )
    await db.commit()
    await db.refresh(target)
    return UserOut(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        role=target.role,
        is_active=target.is_active,
        assigned_property_ids=list(body.property_ids),
    )
