"""Reporting and totals services extracted from core for easier maintenance."""
from __future__ import annotations

import logging

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..models import MatchTypeSetting, UnreconciledTransaction
from .periods import _get_current_working_period_int

logger = logging.getLogger("app.services")

def get_match_type_totals(db: Session) -> dict[str, object]:
    """Calculate match type totals (count and amount) for all active match types."""
    try:
        current_period_int = _get_current_working_period_int(db)
        if current_period_int is None:
            return {
                "match_types": {},
                "overall": {
                    "count_matched": 0,
                    "total_matched": 0.0,
                    "count_unreconciled": 0,
                    "total_unreconciled": 0.0,
                },
                "unmatched": {"count": 0, "total": 0.0},
            }

        match_types = db.query(MatchTypeSetting).all()

        result = {
            "match_types": {},
            "overall": {
                "count_matched": 0,
                "total_matched": 0.0,
                "count_unreconciled": 0,
                "total_unreconciled": 0.0,
            },
        }

        total_matched_count = 0
        total_matched_amount = 0.0

        for match_type in match_types:
            matched_count = match_type.total_count or 0
            matched_total = float(match_type.total_amount or 0)
            elapsed_time = match_type.elapsed_time or 0

            result["match_types"][match_type.key] = {
                "count": matched_count,
                "total": matched_total,
                "elapsed_time": elapsed_time,
            }

           

        # Single query to calculate all totals based on status
        result_row = db.execute(
            select(
                func.sum(
                    case(
                        (UnreconciledTransaction.status == "matched", 1),
                        else_=0,
                    )
                ).label("count_matched"),
                func.sum(
                    case(
                        (UnreconciledTransaction.status == "matched", 
                         case(
                             (UnreconciledTransaction.Source == "System", UnreconciledTransaction.Amount * -1),
                             else_=UnreconciledTransaction.Amount,
                         )),
                        else_=0,
                    )
                ).label("total_matched"),
                func.sum(
                    case(
                        (UnreconciledTransaction.status == "unreconciled", 1),
                        else_=0,
                    )
                ).label("count_unreconciled"),
                func.sum(
                    case(
                        (UnreconciledTransaction.status == "unreconciled",UnreconciledTransaction.Amount),
                        else_=0,
                    )
                ).label("total_unreconciled")
            ).where(
                UnreconciledTransaction.action_period == current_period_int,
            )
        ).first()

        count_matched = int(result_row.count_matched or 0)
        total_matched = float(result_row.total_matched or 0)
        count_unreconciled = int(result_row.count_unreconciled or 0)
        total_unreconciled = float(result_row.total_unreconciled or 0)

        result["overall"]["count_matched"] = count_matched
        result["overall"]["total_matched"] = total_matched
        result["overall"]["count_unreconciled"] = count_unreconciled
        result["overall"]["total_unreconciled"] = total_unreconciled

        return result
    except Exception as e:
        logger.error(f"Error calculating match type totals: {str(e)}", exc_info=True)
        return {
            "match_types": {},
            "overall": {"total_matched_count": 0, "total_matched_amount": 0.0},
            "unmatched": {"count": 0, "total": 0.0},
        }
