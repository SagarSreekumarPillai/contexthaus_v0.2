import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Property, Source, Fact, User
from app.api.deps import get_current_user
from app.services.access import get_property_for_user, can_ingest
from app.services.audit_service import write_audit
from app.core.llm import generate, generate_json, FLASH, PRO
from app.core.patcher import patch_section, diff_sections, get_section
from prompts.context_generate import SYSTEM, GENERATE_CONTEXT, PATCH_SECTION, SIGNAL_CHECK
import pypdf
import io

router = APIRouter()


async def extract_text(file: UploadFile) -> str:
    content = await file.read()
    if file.filename.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return content.decode("utf-8", errors="ignore")


async def extract_text_with_schema(
    file: UploadFile, address: str = "", source_type: str = ""
) -> tuple[str, bool]:
    """Returns (text, is_erp_csv). source_type takes priority over file extension."""
    content = await file.read()

    if source_type == "erp":
        from app.core.erp_parser import parse_erp_csv
        text = content.decode("utf-8", errors="ignore")
        parsed = parse_erp_csv(text, target_address=address)
        return (parsed, True) if parsed else (text, False)

    if source_type == "pdf":
        reader = pypdf.PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages), False

    if source_type in ("email", "slack", "other"):
        return content.decode("utf-8", errors="ignore"), False

    # Fallback: infer from file extension when source_type is unset
    if file.filename and file.filename.endswith(".csv"):
        from app.core.erp_parser import parse_erp_csv
        text = content.decode("utf-8", errors="ignore")
        parsed = parse_erp_csv(text, target_address=address)
        return (parsed, True) if parsed else (text, False)
    if file.filename and file.filename.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages), False
    return content.decode("utf-8", errors="ignore"), False


async def check_signal(text: str, property_name: str, address: str) -> dict:
    from app.core.classifier import classify_relevance
    result = await classify_relevance(text)
    return {
        "relevant": result.get("relevant", True),
        "reason": result.get("reason", ""),
        "section": None,
        "entities": result.get("entities", []),
    }


@router.post("/{property_id}/source")
async def ingest_source(
    property_id: str,
    file: UploadFile = File(...),
    source_type: str = Form(default="email"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prop = await get_property_for_user(db, user, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if not can_ingest(user):
        raise HTTPException(status_code=403, detail="Ingest requires admin or verwalter role")

    text, is_erp = await extract_text_with_schema(file, address=prop.address, source_type=source_type)
    if is_erp:
        # ERP CSV: skip signal check, directly patch from structured data
        signal = {"relevant": True, "section": None}

    if prop.context_md and prop.context_md.strip():
        signal = await check_signal(text, prop.name, prop.address)
        if not signal.get("relevant", True):
            return {"status": "ignored", "reason": signal.get("reason"), "changes": []}
    else:
        signal = {"relevant": True, "section": None}

    source = Source(
        id=str(uuid.uuid4()),
        property_id=property_id,
        filename=file.filename,
        source_type=source_type,
        raw_content=text[:50000],
    )
    db.add(source)
    await db.flush()

    old_md = prop.context_md or ""

    if not old_md.strip():
        sources_text = f"[{source_type.upper()}] {file.filename}:\n{text[:10000]}"
        prompt = GENERATE_CONTEXT.format(
            property_name=prop.name,
            address=prop.address,
            sources=sources_text,
            source_list=file.filename,
        )
        new_md = await generate(prompt=prompt, system=SYSTEM, model=PRO)

        # Tavily enrichment
        from app.core.enricher import enrich_property
        enrichment = await enrich_property(prop.address, prop.name)
        if False:  # Tavily disabled for demo
            new_md = patch_section(new_md, "Notes", enrichment[:500])
    else:
        section = signal.get("section") or "Open Issues"
        current = get_section(old_md, section) or ""
        patch_prompt = PATCH_SECTION.format(
            section_name=section,
            current_content=current,
            source_name=file.filename,
            new_info=text[:3000],
        )
        new_section_content = await generate(prompt=patch_prompt, system=SYSTEM, model=FLASH)
        new_md = patch_section(old_md, section, new_section_content)

    changes = diff_sections(old_md, new_md)
    prop.context_md = new_md
    await write_audit(
        db,
        organization_id=user.organization_id,
        user_id=user.id,
        action="ingest_success",
        resource_type="property",
        resource_id=property_id,
        detail=file.filename or "",
    )
    await db.commit()

    return {
        "status": "ingested",
        "source_id": source.id,
        "filename": file.filename,
        "section_updated": signal.get("section"),
        "changes": changes,
        "context_md": new_md,
    }


@router.get("/{property_id}/context")
async def get_context(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prop = await get_property_for_user(db, user, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"property_id": property_id, "context_md": prop.context_md}
