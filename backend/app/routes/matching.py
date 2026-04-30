"""Transaction matching routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import asyncio
import logging

from app.database import get_db
from app.models import MatchTypeSetting
from app.communications import get_connection_manager
from app.schemas import (
    FileMatchingRequest,
    UpdateMatchTypeOrderRequest,
    UpdateMatchTypeSettingsRequest,
)
from app.services import (
    match_from_file,
    match_one_to_one,
    match_one_to_many,
    get_match_type_totals,
    reset_match_type,
    reset_all_transactions,
    update_match_type_order,
)
from app.services.settings import DBSettingsManager
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/match", tags=["matching"])


@router.post("/from-file")
def match_from_file_endpoint(
    key: str = Query(...),
    payload: FileMatchingRequest = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """File-based matching endpoint for transaction IDs."""
    result = match_from_file(db, key, payload.model_dump() if payload else {})

    # Broadcast stats update via WebSocket if match was successful
    if result.get("status") == "success":
        connection_manager = get_connection_manager()
        stats = {
            "matched_count": result.get("matched_count", 0),
            "matched_total_amount": result.get("matched_total_amount", 0),
            "elapsed_time": result.get("elapsed_time", 0),
        }
        logger.info(f"Match successful for key '{key}'. Broadcasting stats: {stats}")
        asyncio.create_task(connection_manager.broadcast_stats_update(key, stats))

    return result


@router.post("/one-to-many/{key}")
def match_one_to_many_endpoint(
    key: str, db: Session = Depends(get_db)
) -> dict[str, object]:
    """OneToMany matching for pattern-based matching."""
    result = match_one_to_many(db, key)

    if result.get("status") == "success":
        connection_manager = get_connection_manager()
        stats = {
            "matched_count": result.get("matched_count", 0),
            "matched_total_amount": result.get("matched_total_amount", 0),
            "elapsed_time": result.get("elapsed_time", 0),
        }
        logger.info(f"Match successful for key '{key}'. Broadcasting stats: {stats}")
        asyncio.create_task(connection_manager.broadcast_stats_update(key, stats))

    return result


@router.post("/one-to-one/{key}")
def match_one_to_one_endpoint(
    key: str, db: Session = Depends(get_db)
) -> dict[str, object]:
    """OneToOne matching for paired transaction matching."""
    result = match_one_to_one(db, key)

    if result.get("status") == "success":
        connection_manager = get_connection_manager()
        stats = {
            "matched_count": result.get("matched_count", 0),
            "matched_total_amount": result.get("matched_total_amount", 0),
            "elapsed_time": result.get("elapsed_time", 0),
        }
        logger.info(f"Match successful for key '{key}'. Broadcasting stats: {stats}")
        asyncio.create_task(connection_manager.broadcast_stats_update(key, stats))

    return result


@router.post("/reset-by-key/{key}")
@router.post("/by-key/{key}")
def reset_by_key_endpoint(key: str, db: Session = Depends(get_db)) -> dict[str, object]:
    """Reset matching for a specific match type by key."""
    return reset_match_type(db, key)


@router.post("/reset-all")
def reset_all_endpoint(db: Session = Depends(get_db)) -> dict[str, object]:
    """Reset ALL transactions to unreconciled status."""
    return reset_all_transactions(db)


@router.get("/match-type-totals")
def match_type_totals_endpoint(
    db: Session = Depends(get_db),
) -> dict[str, dict[str, object]]:
    """Get totals for each active match type."""
    return get_match_type_totals(db)


@router.post("/update-order")
def update_match_type_order_endpoint(
    payload: UpdateMatchTypeOrderRequest, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Update the display order of match types."""
    return update_match_type_order(db, payload.match_type_keys)


@router.put("/update-settings/{key}")
def update_match_type_settings_endpoint(
    key: str, payload: UpdateMatchTypeSettingsRequest, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Update settings for a match type by key."""
    try:
        settings_manager = DBSettingsManager(db)
        match_type = settings_manager.get_match_type(key)
        if not match_type:
            return {"status": "error", "message": f"Match type '{key}' not found"}

        settings_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        settings_manager.update_match_type_settings(key, settings_data)

        updated = settings_manager.get_match_type(key)
        return {
            "status": "success",
            "message": f"Settings updated for '{key}'",
            "match_type": updated,
        }
    except Exception as e:
        logger.error(f"Error updating match type settings: {e}")
        return {"status": "error", "message": str(e)}


@router.put("/types/{key}")
def update_match_type_by_key_endpoint(
    key: str, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Update match type values by key in database."""
    try:
        match_type = db.execute(
            select(MatchTypeSetting).where(MatchTypeSetting.key == key)
        ).scalar_one_or_none()

        if not match_type:
            return {"status": "error", "message": f"Match type '{key}' not found"}

        db.commit()

        return {
            "status": "success",
            "message": f"Match type '{key}' updated",
            "match_type": match_type,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating match type '{key}': {e}")
        return {"status": "error", "message": str(e)}
