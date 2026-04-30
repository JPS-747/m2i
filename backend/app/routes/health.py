"""Health check and transaction query routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import logging

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
