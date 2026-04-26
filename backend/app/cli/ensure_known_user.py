"""
Ensure a known admin user exists in the real DATABASE_URL (create or reset password).

Run from the backend directory so .env and SQLite paths resolve as for uvicorn:

    ALLOW_KNOWN_USER_SETUP=true KNOWN_USER_PASSWORD='...' python -m app.cli.ensure_known_user

Requires ALLOW_KNOWN_USER_SETUP to be truthy and KNOWN_USER_PASSWORD (8+ characters).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")


def _truthy(val: str | None) -> bool:
    if not val:
        return False
    return val.strip().lower() in ("1", "true", "yes", "on")


async def _run() -> int:
    if not _truthy(os.getenv("ALLOW_KNOWN_USER_SETUP")):
        print(
            "Refusing to run: set ALLOW_KNOWN_USER_SETUP=true and KNOWN_USER_PASSWORD in the environment "
            "(or backend/.env), then run again from backend/: python -m app.cli.ensure_known_user",
            file=sys.stderr,
        )
        return 1

    from pydantic import EmailStr, TypeAdapter

    email_raw = (os.getenv("KNOWN_USER_EMAIL") or "admin@example.com").strip().lower()
    try:
        TypeAdapter(EmailStr).validate_python(email_raw)
    except Exception as exc:
        print(f"Invalid KNOWN_USER_EMAIL: {exc}", file=sys.stderr)
        return 1

    password = os.getenv("KNOWN_USER_PASSWORD") or ""
    if len(password) < 8:
        print("KNOWN_USER_PASSWORD must be set and at least 8 characters.", file=sys.stderr)
        return 1

    full_name = (os.getenv("KNOWN_USER_FULL_NAME") or "Dev known user").strip() or "Dev known user"
    org_name = (os.getenv("KNOWN_USER_ORG_NAME") or "Local Dev").strip() or "Local Dev"

    from sqlalchemy import select

    from app.core.security import hash_password
    from app.db.database import AsyncSessionLocal
    from app.db.models import Organization, User, ROLE_ADMIN
    from app.services.audit_service import write_audit

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email_raw))
        existing = result.scalars().first()

        if existing:
            existing.password_hash = hash_password(password)
            existing.role = ROLE_ADMIN
            existing.is_active = True
            if full_name:
                existing.full_name = full_name
            await write_audit(
                db,
                organization_id=existing.organization_id,
                user_id=existing.id,
                action="ensure_known_user",
                resource_type="user",
                resource_id=existing.id,
                detail=f"Password reset / role ensured for {existing.email}",
            )
            await db.commit()
            print(f"Updated existing user: {existing.email} (admin, active). Password was reset.")
            return 0

        org_result = await db.execute(select(Organization).order_by(Organization.id).limit(1))
        org = org_result.scalar_one_or_none()
        if not org:
            org = Organization(id=str(uuid.uuid4()), name=org_name)
            db.add(org)
            await db.flush()

        user = User(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            email=email_raw,
            password_hash=hash_password(password),
            full_name=full_name,
            role=ROLE_ADMIN,
            is_active=True,
        )
        db.add(user)
        await write_audit(
            db,
            organization_id=org.id,
            user_id=user.id,
            action="ensure_known_user",
            resource_type="user",
            resource_id=user.id,
            detail=f"Created known dev admin {user.email}",
        )
        await db.commit()
        print(f"Created admin user: {user.email} in organization {org.name!r} ({org.id}).")
        return 0


def main() -> None:
    raise SystemExit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
