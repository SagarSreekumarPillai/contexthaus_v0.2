from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Property, Vendor, VendorAvailability, VendorBooking, VendorCommunication

router = APIRouter()


class AvailabilityInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class VendorCreate(BaseModel):
    name: str
    service_type: str
    contact_email: str = ""
    contact_phone: str = ""
    hourly_rate: float = 0.0
    currency: str = "EUR"
    availability: list[AvailabilityInput] = []


class VendorResponse(BaseModel):
    id: str
    property_id: str
    name: str
    service_type: str
    contact_email: str
    contact_phone: str
    hourly_rate: float
    currency: str
    created_at: str


class BookingCreate(BaseModel):
    title: str
    starts_at: datetime
    ends_at: datetime
    estimated_cost: float = 0.0
    status: str = "scheduled"


class BookingResponse(BaseModel):
    id: str
    vendor_id: str
    property_id: str
    title: str
    starts_at: str
    ends_at: str
    status: str
    estimated_cost: float
    created_at: str


class AvailabilityResponse(BaseModel):
    id: str
    vendor_id: str
    day_of_week: int
    start_time: str
    end_time: str


class VendorRecommendation(BaseModel):
    vendor: VendorResponse
    reason: str
    estimated_cost: float
    is_available_for_slot: bool
    has_booking_conflict: bool
    next_open_window: str | None


class VendorCommunicationCreate(BaseModel):
    channel: str = Field(pattern="^(email|call|sms)$")
    direction: str = "outbound"
    subject: str = ""
    message: str
    status: str = "sent"
    booking_id: str | None = None


class VendorCommunicationResponse(BaseModel):
    id: str
    vendor_id: str
    property_id: str
    booking_id: str | None
    channel: str
    direction: str
    subject: str
    message: str
    status: str
    created_at: str


class AutoDispatchRequest(BaseModel):
    service_type: str
    issue_title: str
    issue_description: str = ""
    priority: str = "medium"  # low, medium, high, urgent
    target_starts_at: datetime | None = None
    duration_minutes: int = 120
    # When False (default), only vendors free in the computed window and within weekly hours are booked.
    allow_outside_hours: bool = False


class AutoDispatchResponse(BaseModel):
    recommendation: VendorRecommendation
    booking: BookingResponse
    communication: VendorCommunicationResponse


@router.get("/property/{property_id}", response_model=list[VendorResponse])
async def list_property_vendors(property_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Vendor).where(Vendor.property_id == property_id).order_by(Vendor.created_at.desc())
    )
    vendors = result.scalars().all()
    return [
        VendorResponse(
            id=v.id,
            property_id=v.property_id,
            name=v.name,
            service_type=v.service_type,
            contact_email=v.contact_email,
            contact_phone=v.contact_phone,
            hourly_rate=v.hourly_rate,
            currency=v.currency,
            created_at=v.created_at.isoformat(),
        )
        for v in vendors
    ]


@router.post("/property/{property_id}", response_model=VendorResponse)
async def create_vendor(property_id: str, data: VendorCreate, db: AsyncSession = Depends(get_db)):
    property_result = await db.execute(select(Property).where(Property.id == property_id))
    prop = property_result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    vendor = Vendor(
        id=str(uuid.uuid4()),
        property_id=property_id,
        name=data.name,
        service_type=data.service_type,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        hourly_rate=data.hourly_rate,
        currency=data.currency,
    )
    db.add(vendor)
    await db.flush()

    for slot in data.availability:
        db.add(
            VendorAvailability(
                id=str(uuid.uuid4()),
                vendor_id=vendor.id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
            )
        )

    await db.commit()
    await db.refresh(vendor)
    return VendorResponse(
        id=vendor.id,
        property_id=vendor.property_id,
        name=vendor.name,
        service_type=vendor.service_type,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        hourly_rate=vendor.hourly_rate,
        currency=vendor.currency,
        created_at=vendor.created_at.isoformat(),
    )


@router.get("/{vendor_id}/availability", response_model=list[AvailabilityResponse])
async def list_vendor_availability(vendor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VendorAvailability)
        .where(VendorAvailability.vendor_id == vendor_id)
        .order_by(VendorAvailability.day_of_week.asc(), VendorAvailability.start_time.asc())
    )
    slots = result.scalars().all()
    return [
        AvailabilityResponse(
            id=s.id,
            vendor_id=s.vendor_id,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
        )
        for s in slots
    ]


@router.post("/{vendor_id}/availability", response_model=list[AvailabilityResponse])
async def replace_vendor_availability(
    vendor_id: str, slots: list[AvailabilityInput], db: AsyncSession = Depends(get_db)
):
    vendor_result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = vendor_result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    existing_result = await db.execute(select(VendorAvailability).where(VendorAvailability.vendor_id == vendor_id))
    for item in existing_result.scalars().all():
        await db.delete(item)

    for slot in slots:
        db.add(
            VendorAvailability(
                id=str(uuid.uuid4()),
                vendor_id=vendor_id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
            )
        )

    await db.commit()
    return await list_vendor_availability(vendor_id, db)


@router.get("/{vendor_id}/bookings", response_model=list[BookingResponse])
async def list_vendor_bookings(vendor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VendorBooking).where(VendorBooking.vendor_id == vendor_id).order_by(VendorBooking.starts_at.asc())
    )
    bookings = result.scalars().all()
    return [
        BookingResponse(
            id=b.id,
            vendor_id=b.vendor_id,
            property_id=b.property_id,
            title=b.title,
            starts_at=b.starts_at.isoformat(),
            ends_at=b.ends_at.isoformat(),
            status=b.status,
            estimated_cost=b.estimated_cost,
            created_at=b.created_at.isoformat(),
        )
        for b in bookings
    ]


@router.post("/{vendor_id}/bookings", response_model=BookingResponse)
async def create_vendor_booking(vendor_id: str, data: BookingCreate, db: AsyncSession = Depends(get_db)):
    vendor_result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = vendor_result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if data.ends_at <= data.starts_at:
        raise HTTPException(status_code=400, detail="Booking end must be after start")

    conflict_result = await db.execute(
        select(VendorBooking).where(
            and_(
                VendorBooking.vendor_id == vendor_id,
                VendorBooking.status != "cancelled",
                VendorBooking.starts_at < data.ends_at,
                VendorBooking.ends_at > data.starts_at,
            )
        )
    )
    conflict = conflict_result.scalar_one_or_none()
    if conflict:
        raise HTTPException(status_code=409, detail="Vendor already booked for this time range")

    booking = VendorBooking(
        id=str(uuid.uuid4()),
        vendor_id=vendor_id,
        property_id=vendor.property_id,
        title=data.title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        status=data.status,
        estimated_cost=data.estimated_cost,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return BookingResponse(
        id=booking.id,
        vendor_id=booking.vendor_id,
        property_id=booking.property_id,
        title=booking.title,
        starts_at=booking.starts_at.isoformat(),
        ends_at=booking.ends_at.isoformat(),
        status=booking.status,
        estimated_cost=booking.estimated_cost,
        created_at=booking.created_at.isoformat(),
    )


@router.get("/property/{property_id}/recommendations", response_model=list[VendorRecommendation])
async def recommend_vendors(
    property_id: str,
    service_type: str,
    starts_at: datetime,
    ends_at: datetime,
    db: AsyncSession = Depends(get_db),
):
    if ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="Booking end must be after start")

    vendor_result = await db.execute(
        select(Vendor).where(
            and_(
                Vendor.property_id == property_id,
                Vendor.service_type.ilike(service_type),
            )
        )
    )
    candidates = vendor_result.scalars().all()
    recommendations: list[VendorRecommendation] = []

    start_hm = starts_at.strftime("%H:%M")
    end_hm = ends_at.strftime("%H:%M")
    day_idx = starts_at.weekday()
    duration_hours = (ends_at - starts_at).total_seconds() / 3600

    for vendor in candidates:
        availability_result = await db.execute(
            select(VendorAvailability).where(VendorAvailability.vendor_id == vendor.id)
        )
        slots = availability_result.scalars().all()
        slot_cover = any(
            slot.day_of_week == day_idx and slot.start_time <= start_hm and slot.end_time >= end_hm
            for slot in slots
        )
        next_open_window = None
        if slots:
            ordered = sorted(slots, key=lambda x: (x.day_of_week, x.start_time))
            next_slot = ordered[0]
            next_open_window = f"{next_slot.day_of_week}:{next_slot.start_time}-{next_slot.end_time}"

        conflict_result = await db.execute(
            select(VendorBooking).where(
                and_(
                    VendorBooking.vendor_id == vendor.id,
                    VendorBooking.status != "cancelled",
                    VendorBooking.starts_at < ends_at,
                    VendorBooking.ends_at > starts_at,
                )
            )
        )
        has_conflict = conflict_result.scalar_one_or_none() is not None

        available = slot_cover and not has_conflict
        reason = "Available in requested window" if available else (
            "Conflicting booking exists" if has_conflict else "Outside declared availability"
        )
        recommendations.append(
            VendorRecommendation(
                vendor=VendorResponse(
                    id=vendor.id,
                    property_id=vendor.property_id,
                    name=vendor.name,
                    service_type=vendor.service_type,
                    contact_email=vendor.contact_email,
                    contact_phone=vendor.contact_phone,
                    hourly_rate=vendor.hourly_rate,
                    currency=vendor.currency,
                    created_at=vendor.created_at.isoformat(),
                ),
                reason=reason,
                estimated_cost=round(duration_hours * vendor.hourly_rate, 2),
                is_available_for_slot=available,
                has_booking_conflict=has_conflict,
                next_open_window=next_open_window,
            )
        )

    recommendations.sort(
        key=lambda r: (
            not r.is_available_for_slot,
            r.has_booking_conflict,
            r.estimated_cost,
            r.vendor.hourly_rate,
        )
    )
    return recommendations


@router.get("/{vendor_id}/communications", response_model=list[VendorCommunicationResponse])
async def list_vendor_communications(vendor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VendorCommunication)
        .where(VendorCommunication.vendor_id == vendor_id)
        .order_by(VendorCommunication.created_at.desc())
    )
    communications = result.scalars().all()
    return [
        VendorCommunicationResponse(
            id=c.id,
            vendor_id=c.vendor_id,
            property_id=c.property_id,
            booking_id=c.booking_id,
            channel=c.channel,
            direction=c.direction,
            subject=c.subject,
            message=c.message,
            status=c.status,
            created_at=c.created_at.isoformat(),
        )
        for c in communications
    ]


@router.post("/{vendor_id}/communications", response_model=VendorCommunicationResponse)
async def create_vendor_communication(
    vendor_id: str, data: VendorCommunicationCreate, db: AsyncSession = Depends(get_db)
):
    vendor_result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = vendor_result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    booking_id = data.booking_id
    if booking_id:
        booking_result = await db.execute(select(VendorBooking).where(VendorBooking.id == booking_id))
        booking = booking_result.scalar_one_or_none()
        if not booking or booking.vendor_id != vendor_id:
            raise HTTPException(status_code=400, detail="Booking does not belong to vendor")

    communication = VendorCommunication(
        id=str(uuid.uuid4()),
        vendor_id=vendor_id,
        property_id=vendor.property_id,
        booking_id=booking_id,
        channel=data.channel,
        direction=data.direction,
        subject=data.subject,
        message=data.message,
        status=data.status,
    )
    db.add(communication)
    await db.commit()
    await db.refresh(communication)
    return VendorCommunicationResponse(
        id=communication.id,
        vendor_id=communication.vendor_id,
        property_id=communication.property_id,
        booking_id=communication.booking_id,
        channel=communication.channel,
        direction=communication.direction,
        subject=communication.subject,
        message=communication.message,
        status=communication.status,
        created_at=communication.created_at.isoformat(),
    )


@router.post("/property/{property_id}/auto-dispatch", response_model=AutoDispatchResponse)
async def auto_dispatch_vendor(
    property_id: str, data: AutoDispatchRequest, db: AsyncSession = Depends(get_db)
):
    start_time = data.target_starts_at
    if not start_time:
        offset_hours = {"low": 72, "medium": 24, "high": 8, "urgent": 2}.get(data.priority, 24)
        start_time = datetime.utcnow() + timedelta(hours=offset_hours)
    end_time = start_time + timedelta(minutes=max(30, data.duration_minutes))

    recommendations = await recommend_vendors(
        property_id=property_id,
        service_type=data.service_type,
        starts_at=start_time,
        ends_at=end_time,
        db=db,
    )
    if not recommendations:
        raise HTTPException(status_code=404, detail="No vendors found for service type")

    if not data.allow_outside_hours:
        available = [rec for rec in recommendations if rec.is_available_for_slot]
        if not available:
            raise HTTPException(
                status_code=422,
                detail="No vendor is available in that window. Add availability, pick another time, or set allow_outside_hours=true.",
            )
        chosen = available[0]
    else:
        chosen = next((rec for rec in recommendations if rec.is_available_for_slot), recommendations[0])

    booking = await create_vendor_booking(
        vendor_id=chosen.vendor.id,
        data=BookingCreate(
            title=data.issue_title,
            starts_at=start_time,
            ends_at=end_time,
            estimated_cost=chosen.estimated_cost,
            status="scheduled",
        ),
        db=db,
    )

    message = (
        f"Hello {chosen.vendor.name},\n\n"
        f"We need support for: {data.issue_title}\n"
        f"Priority: {data.priority}\n"
        f"Proposed window: {booking.starts_at} to {booking.ends_at}\n"
        f"Details: {data.issue_description or 'n/a'}\n\n"
        "Please confirm availability.\n"
    )
    communication = await create_vendor_communication(
        vendor_id=chosen.vendor.id,
        data=VendorCommunicationCreate(
            channel="email",
            subject=f"Dispatch request: {data.issue_title}",
            message=message,
            status="sent",
            booking_id=booking.id,
        ),
        db=db,
    )

    return AutoDispatchResponse(
        recommendation=chosen,
        booking=booking,
        communication=communication,
    )
