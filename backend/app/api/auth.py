import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Organization, User, ROLE_ADMIN
from app.core.security import hash_password, verify_password, create_access_token
from app.services.audit_service import write_audit
from app.api.deps import get_current_user

router = APIRouter()


class BootstrapBody(BaseModel):
    organization_name: str = Field(min_length=1, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
    admin_full_name: str = Field(default="", max_length=255)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization_id: str
    organization_name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


def _user_public(user: User, org_name: str) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org_name,
    )


@router.post("/bootstrap", response_model=TokenResponse)
async def bootstrap_first_admin(body: BootstrapBody, db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    if n > 0:
        raise HTTPException(status_code=403, detail="Bootstrap is disabled after the first user is created")
    org = Organization(id=str(uuid.uuid4()), name=body.organization_name)
    db.add(org)
    await db.flush()
    user = User(
        id=str(uuid.uuid4()),
        organization_id=org.id,
        email=body.admin_email.lower(),
        password_hash=hash_password(body.admin_password),
        full_name=body.admin_full_name,
        role=ROLE_ADMIN,
        is_active=True,
    )
    db.add(user)
    await write_audit(
        db,
        organization_id=org.id,
        user_id=user.id,
        action="bootstrap",
        resource_type="organization",
        resource_id=org.id,
        detail=f"Created organization and admin user {user.email}",
    )
    await db.commit()
    await db.refresh(user)
    token = create_access_token(
        user_id=user.id,
        org_id=user.organization_id,
        email=user.email,
        role=user.role,
    )
    return TokenResponse(access_token=token, user=_user_public(user, org.name))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    org = await db.get(Organization, user.organization_id)
    org_name = org.name if org else ""
    await write_audit(
        db,
        organization_id=user.organization_id,
        user_id=user.id,
        action="login",
        resource_type="user",
        resource_id=user.id,
        detail="",
    )
    await db.commit()
    token = create_access_token(
        user_id=user.id,
        org_id=user.organization_id,
        email=user.email,
        role=user.role,
    )
    return TokenResponse(access_token=token, user=_user_public(user, org_name))


@router.get("/me", response_model=UserPublic)
async def read_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = await db.get(Organization, user.organization_id)
    org_name = org.name if org else ""
    return _user_public(user, org_name)
