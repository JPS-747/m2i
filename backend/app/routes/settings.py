"""Settings management routes."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.settings import DBSettingsManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/match-types")
def get_settings_match_types(db: Session = Depends(get_db)) -> dict[str, object]:
    """Get all match type configurations from the database."""
    sm = DBSettingsManager(db)
    return {
        "match_types": sm.get_all_match_types(),
        "categories": sm.get_categories(),
        "totals": sm.get_total_stats(),
    }


@router.get("/match-types/{key}")
def get_settings_match_type(key: str, db: Session = Depends(get_db)) -> dict[str, object]:
    """Get a specific match type configuration from the database."""
    sm = DBSettingsManager(db)
    match_type = sm.get_match_type(key)
    if not match_type:
        return {"error": f"Match type '{key}' not found", "status": "error"}
    return {"status": "success", "match_type": match_type}



@router.get("/categories")
def get_settings_categories(db: Session = Depends(get_db)) -> dict[str, object]:
    """Get all match type categories from the database."""
    sm = DBSettingsManager(db)
    return {"categories": sm.get_categories(), "status": "success"}


@router.get("/stats")
def get_settings_stats(db: Session = Depends(get_db)) -> dict[str, object]:
    """Get aggregated statistics from the database."""
    sm = DBSettingsManager(db)
    return {"stats": sm.get_total_stats(), "status": "success"}
