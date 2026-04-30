"""Database-backed settings manager for match type configuration."""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import MatchTypeSetting, MatchTypeCategory

logger = logging.getLogger(__name__)

# Static mapping: match type category → API method name
_TYPE_TO_METHOD = {
    "File": "matchFromFile",
    "OneToMany": "matchOneToMany",
    "OneToOne": "matchOneToOne",
}


def _setting_to_dict(row: MatchTypeSetting) -> Dict[str, Any]:
    """Convert a MatchTypeSetting ORM row to the canonical dict format."""
    params = None
    if row.parameters:
        try:
            params = json.loads(row.parameters)
        except (json.JSONDecodeError, TypeError):
            params = None

    return {
        "key": row.key,
        "title": row.title,
        "description": row.description,
        "type": row.type,
        "display_order": row.display_order,
        "is_active": row.is_active,
        "parameters": params,
    }


class DBSettingsManager:
    """
    Database-backed replacement for the JSON SettingsManager.
    Stores and retrieves match type configuration from the database.
    Provides the same interface as SettingsManager for drop-in compatibility.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Read helpers                                                         #
    # ------------------------------------------------------------------ #

    def get_all_match_types(self) -> List[Dict[str, Any]]:
        """Return all match types sorted by display_order."""
        rows = self.db.scalars(
            select(MatchTypeSetting).order_by(MatchTypeSetting.display_order)
        ).all()
        return [_setting_to_dict(r) for r in rows]

    def get_match_type(self, key: str) -> Optional[Dict[str, Any]]:
        """Return a single match type by key, or None if not found."""
        row = self.db.scalar(
            select(MatchTypeSetting).where(MatchTypeSetting.key == key)
        )
        return _setting_to_dict(row) if row else None

    def get_active_match_types(self, ordered: bool = True) -> List[Dict[str, Any]]:
        """Return all active match types, optionally sorted by display_order."""
        stmt = select(MatchTypeSetting).where(MatchTypeSetting.is_active == True)  # noqa: E712
        if ordered:
            stmt = stmt.order_by(MatchTypeSetting.display_order)
        rows = self.db.scalars(stmt).all()
        return [_setting_to_dict(r) for r in rows]

    def get_match_types_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Return all match types of a specific category."""
        rows = self.db.scalars(
            select(MatchTypeSetting).where(MatchTypeSetting.type == category)
        ).all()
        return [_setting_to_dict(r) for r in rows]

    def get_match_parameters(self, key: str) -> Optional[Dict[str, Any]]:
        """Return the parameters dict for a match type key."""
        mt = self.get_match_type(key)
        return mt.get("parameters") if mt else None

    def get_api_method_for_type(self, match_type: str) -> str:
        """Return the API method name for a match type category."""
        return _TYPE_TO_METHOD.get(match_type, "matchOneToOne")

    def get_categories(self) -> Dict[str, Dict[str, Any]]:
        """Return all categories as a dict keyed by type_key."""
        rows = self.db.scalars(select(MatchTypeCategory)).all()
        return {
            r.type_key: {
                "name": r.name,
                "description": r.description,
                "icon": r.icon,
            }
            for r in rows
        }

    def get_category_info(self, category: str) -> Optional[Dict[str, Any]]:
        """Return info for a single category, or None."""
        row = self.db.scalar(
            select(MatchTypeCategory).where(MatchTypeCategory.type_key == category)
        )
        if not row:
            return None
        return {"name": row.name, "description": row.description, "icon": row.icon}

    # ------------------------------------------------------------------ #
    # Stats helpers (stored directly on MatchTypeSetting table)            #
    # ------------------------------------------------------------------ #

    def get_match_stats(self, key: str) -> Optional[Dict[str, Any]]:
        """Return stats for a match type from the MatchTypeSetting table."""
        row = self.db.scalar(
            select(MatchTypeSetting).where(MatchTypeSetting.key == key)
        )
        if not row:
            return None
        return {
            "total_count": row.total_count,
            "total_amount": float(row.total_amount or 0),
            "elapsed_time": row.elapsed_time,
            "status": row.status,
        }

    def get_total_stats(self) -> Dict[str, Any]:
        """Return aggregated stats across all match types."""
        rows = self.db.scalars(select(MatchTypeSetting)).all()
        total_count = sum(r.total_count or 0 for r in rows)
        total_amount = sum(float(r.total_amount or 0) for r in rows)
        return {
            "total_count": total_count,
            "total_amount": total_amount,
            "last_updated": None,
        }



    # ------------------------------------------------------------------ #
    # Write helpers                                                        #
    # ------------------------------------------------------------------ #

    def update_match_type_settings(self, key: str, settings: Dict[str, Any]) -> bool:
        """
        Update allowed configuration fields for a match type.
        Allowed fields: title, description, type, is_active, display_order, parameters.
        """
        row = self.db.scalar(
            select(MatchTypeSetting).where(MatchTypeSetting.key == key)
        )
        if not row:
            logger.error(f"MatchTypeSetting '{key}' not found")
            return False

        allowed = {"title", "description", "type", "is_active", "display_order"}
        for field in allowed:
            if field in settings:
                setattr(row, field, settings[field])

        # Parameters are stored as JSON text in the DB.
        if "parameters" in settings:
            value = settings["parameters"]
            if value is None:
                row.parameters = None
            elif isinstance(value, str):
                # If frontend sends stringified JSON, normalize it; else store raw string.
                try:
                    parsed = json.loads(value)
                    row.parameters = json.dumps(parsed)
                except (TypeError, json.JSONDecodeError):
                    row.parameters = value
            else:
                row.parameters = json.dumps(value)

        try:
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating settings for '{key}': {e}")
            return False

    def update_display_order(self, key_order: List[str]) -> bool:
        """Bulk-update display_order based on the position in key_order list."""
        try:
            for index, key in enumerate(key_order):
                self.db.execute(
                    update(MatchTypeSetting)
                    .where(MatchTypeSetting.key == key)
                    .values(display_order=index)
                )
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating display order: {e}")
            return False

    def set_match_type_active(self, key: str, is_active: bool) -> bool:
        """Activate or deactivate a match type."""
        return self.update_match_type_settings(key, {"is_active": is_active})
