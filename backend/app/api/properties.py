from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import Property, User
from app.api.deps import get_current_user
from app.services.access import list_properties_query, get_property_for_user, can_write_properties
from app.services.audit_service import write_audit
import uuid
from datetime import datetime

router = APIRouter()


class PropertyCreate(BaseModel):
    name: str
    address: str


class PropertyResponse(BaseModel):
    id: str
    name: str
    address: str
    context_md: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_model(cls, p: Property):
        return cls(
            id=p.id,
            name=p.name,
            address=p.address,
            context_md=p.context_md or "",
            created_at=p.created_at.isoformat() if isinstance(p.created_at, datetime) else str(p.created_at),
            updated_at=p.updated_at.isoformat() if isinstance(p.updated_at, datetime) else str(p.updated_at),
        )


@router.get("/", response_model=list[PropertyResponse])
async def list_properties(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(list_properties_query(user))
    return [PropertyResponse.from_orm_model(p) for p in result.scalars().all()]


@router.post("/", response_model=PropertyResponse)
async def create_property(
    data: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not can_write_properties(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create properties")
    prop = Property(
        id=str(uuid.uuid4()),
        organization_id=user.organization_id,
        name=data.name,
        address=data.address,
    )
    db.add(prop)
    await write_audit(
        db,
        organization_id=user.organization_id,
        user_id=user.id,
        action="property_create",
        resource_type="property",
        resource_id=prop.id,
        detail=data.name,
    )
    await db.commit()
    await db.refresh(prop)
    return PropertyResponse.from_orm_model(prop)


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prop = await get_property_for_user(db, user, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return PropertyResponse.from_orm_model(prop)


@router.delete("/{property_id}")
async def delete_property(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not can_write_properties(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete properties")
    prop = await get_property_for_user(db, user, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    await db.delete(prop)
    await write_audit(
        db,
        organization_id=user.organization_id,
        user_id=user.id,
        action="property_delete",
        resource_type="property",
        resource_id=property_id,
        detail="",
    )
    await db.commit()
    return {"deleted": property_id}
