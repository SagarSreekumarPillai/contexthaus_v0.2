import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Float, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    context_md: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources: Mapped[list["Source"]] = relationship("Source", back_populates="property", cascade="all, delete-orphan")
    facts: Mapped[list["Fact"]] = relationship("Fact", back_populates="property", cascade="all, delete-orphan")
    vendors: Mapped[list["Vendor"]] = relationship("Vendor", back_populates="property", cascade="all, delete-orphan")
    vendor_bookings: Mapped[list["VendorBooking"]] = relationship(
        "VendorBooking", back_populates="property", cascade="all, delete-orphan"
    )


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String, ForeignKey("properties.id"))
    filename: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(50))  # email, pdf, erp, slack
    raw_content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    property: Mapped["Property"] = relationship("Property", back_populates="sources")
    facts: Mapped[list["Fact"]] = relationship("Fact", back_populates="source")


class Fact(Base):
    __tablename__ = "facts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String, ForeignKey("properties.id"))
    source_id: Mapped[str] = mapped_column(String, ForeignKey("sources.id"), nullable=True)
    section: Mapped[str] = mapped_column(String(100))   # e.g. "owner", "contractor", "open_issues"
    key: Mapped[str] = mapped_column(String(255))
    value: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    property: Mapped["Property"] = relationship("Property", back_populates="facts")
    source: Mapped["Source"] = relationship("Source", back_populates="facts")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    property_id: Mapped[str] = mapped_column(String, ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(255))
    service_type: Mapped[str] = mapped_column(String(100))
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(100), default="")
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    property: Mapped["Property"] = relationship("Property", back_populates="vendors")
    availability_slots: Mapped[list["VendorAvailability"]] = relationship(
        "VendorAvailability", back_populates="vendor", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["VendorBooking"]] = relationship(
        "VendorBooking", back_populates="vendor", cascade="all, delete-orphan"
    )
    communications: Mapped[list["VendorCommunication"]] = relationship(
        "VendorCommunication", back_populates="vendor", cascade="all, delete-orphan"
    )


class VendorAvailability(Base):
    __tablename__ = "vendor_availability"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Monday ... 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5))  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5))  # HH:MM
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="availability_slots")


class VendorBooking(Base):
    __tablename__ = "vendor_bookings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    property_id: Mapped[str] = mapped_column(String, ForeignKey("properties.id"))
    title: Mapped[str] = mapped_column(String(255))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(50), default="scheduled")
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="bookings")
    property: Mapped["Property"] = relationship("Property", back_populates="vendor_bookings")
    communications: Mapped[list["VendorCommunication"]] = relationship(
        "VendorCommunication", back_populates="booking", cascade="all, delete-orphan"
    )


class VendorCommunication(Base):
    __tablename__ = "vendor_communications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    property_id: Mapped[str] = mapped_column(String, ForeignKey("properties.id"))
    booking_id: Mapped[str | None] = mapped_column(String, ForeignKey("vendor_bookings.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(50))  # email, call, sms
    direction: Mapped[str] = mapped_column(String(20), default="outbound")
    subject: Mapped[str] = mapped_column(String(255), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="communications")
    property: Mapped["Property"] = relationship("Property")
    booking: Mapped["VendorBooking"] = relationship("VendorBooking", back_populates="communications")