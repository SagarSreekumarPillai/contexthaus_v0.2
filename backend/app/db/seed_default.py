"""Optional single default org + admin when the database has no users."""

import logging
import os
import uuid

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import func, select
from app.db.database import AsyncSessionLocal
from app.db.models import Organization, User, ROLE_ADMIN
from app.core.security import hash_password
from app.services.audit_service import write_audit

logger = logging.getLogger(__name__)


def _truthy(val: str | None) -> bool:
    if not val:
        return False
    return val.strip().lower() in ("1", "true", "yes", "on")


async def seed_default_account_if_enabled() -> None:
    """
    If SEED_DEFAULT_ACCOUNT is truthy and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are set,
    create one organization and admin user when the users table is empty.
    """
    if not _truthy(os.getenv("SEED_DEFAULT_ACCOUNT")):
        return

    email = (os.getenv("SEED_ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("SEED_ADMIN_PASSWORD") or ""
    org_name = (os.getenv("SEED_ORG_NAME") or "Demo Organization").strip() or "Demo Organization"

    if not email:
        logger.warning("SEED_DEFAULT_ACCOUNT is set but SEED_ADMIN_EMAIL is missing; skipping seed.")
        return
    try:
        TypeAdapter(EmailStr).validate_python(email)
    except Exception:
        logger.warning(
            "SEED_ADMIN_EMAIL=%r is not a valid login email (same rules as /api/auth/login); "
            "use an address with a normal domain, e.g. admin@example.com. Skipping seed.",
            email,
        )
        return
    if len(password) < 8:
        logger.warning(
            "SEED_DEFAULT_ACCOUNT is set but SEED_ADMIN_PASSWORD is missing or shorter than 8 characters; skipping seed."
        )
        return

    async with AsyncSessionLocal() as db:
        n = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if int(n or 0) > 0:
            return

        org = Organization(id=str(uuid.uuid4()), name=org_name)
        db.add(org)
        await db.flush()
        user = User(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            email=email,
            password_hash=hash_password(password),
            full_name=os.getenv("SEED_ADMIN_FULL_NAME", "").strip() or "Default admin",
            role=ROLE_ADMIN,
            is_active=True,
        )
        db.add(user)
        await write_audit(
            db,
            organization_id=org.id,
            user_id=user.id,
            action="seed_default_account",
            resource_type="organization",
            resource_id=org.id,
            detail=f"Seeded default admin {user.email} from environment",
        )
        await db.commit()
        logger.info("Seeded default account for %s (organization: %s)", email, org_name)
