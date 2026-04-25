"""Lightweight client analytics sink — same stack as properties/ingest APIs."""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
_log = logging.getLogger("uvicorn.error")


class AnalyticsEvent(BaseModel):
    event: str
    payload: dict[str, Any] = {}
    timestamp: str | None = None


@router.post("/events", status_code=204)
async def receive_analytics_event(body: AnalyticsEvent) -> None:
    """Accept POST JSON from the frontend; log for now (no DB required)."""
    _log.info(
        "[analytics] event=%s timestamp=%s payload=%s",
        body.event,
        body.timestamp,
        body.payload,
    )
