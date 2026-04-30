"""Financial period services extracted from core for easier maintenance."""
from __future__ import annotations

import logging
from typing import Tuple

from fastapi import HTTPException
from sqlalchemy import case, delete, desc, func, select, text, update
from sqlalchemy.orm import Session

from ..models import (
    FinancialPeriod,
    ImportedFile,
    MatchTypeSetting,
    Transaction,
    UnreconciledTransaction,
)

logger = logging.getLogger("app.services")


def _next_period(period: str) -> str:
    year = int(period[:4])
    month = int(period[4:])
    if month == 12:
        return f"{year + 1}01"
    return f"{year}{month + 1:02d}"


def _new_period_row(period: str) -> FinancialPeriod:
    return FinancialPeriod(
        period=period,
        bank_total=0,
        bank_count=0,
        system_total=0,
        system_count=0,
        bbf_total=0,
        bbf_count=0,
        matched_total=0,
        matched_count=0,
        reconciled_total=0,
        reconciled_count=0,
        status="Open",
    )


def _get_current_open_period_int(db: Session) -> int:
    current_open_period = db.scalar(
        select(FinancialPeriod.period)
        .where(FinancialPeriod.status == "Open")
        .order_by(desc(FinancialPeriod.period))
        .limit(1)
    )

    if not current_open_period:
        raise HTTPException(
            status_code=409,
            detail="No open financial period available.",
        )

    try:
        return int(current_open_period)
    except ValueError:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid current financial period value: {current_open_period}",
        )


def _get_current_working_period_int(db: Session) -> int | None:
    """Get the current working period (open or active). Returns None if neither exists."""
    current_period = db.scalar(
        select(FinancialPeriod.period)
        .where(FinancialPeriod.status.in_(["Open", "Active"]))
        .order_by(desc(FinancialPeriod.period))
        .limit(1)
    )

    if not current_period:
        return None

    try:
        return int(current_period)
    except ValueError:
        return None


def close_period(db: Session, period: str) -> Tuple[str, str, bool]:
    """
    Close a financial period with the following validations and operations:
    1. Period must exist and have status='Active'
    2. Matched count must be > 30000
    3. Matched total must be = 0 (balanced)
    4. If valid: update all 'matched' transactions to 'reconciled'
    5. Copy 'reconciled' transactions to Transaction table
    6. Delete 'reconciled' transactions from UnreconciledTransaction
    7. Update action_period of remaining unreconciled transactions to new period
    8. Create next period if it doesn't exist
    
    All operations are wrapped in a transaction that will be rolled back if any error occurs.
    """
    current = db.get(FinancialPeriod, period)
    if not current:
        raise HTTPException(status_code=404, detail=f"Period {period} was not found.")

    # Validate period status is Active
    if current.status != "Active":
        raise HTTPException(
            status_code=409, 
            detail=f"Period {period} must be Active to close. Current status: {current.status}"
        )

    # Validate matched count > 30000
    if current.matched_count <= 30000:
        raise HTTPException(
            status_code=409, 
            detail=f"Period {period} cannot be closed. Matched count ({current.matched_count}) must be > 30000."
        )

    # Validate matched total = 0 (balanced)
    if current.matched_total != 0:
        raise HTTPException(
            status_code=409, 
            detail=f"Period {period} cannot be closed. Matched total ({current.matched_total}) must equal 0 (balanced)."
        )

    try:
        # Start transaction - all operations below will be rolled back if any error occurs
        db.begin_nested()  # Create a savepoint
        
        period_int = int(period)

        # Step 1: Update all 'matched' transactions to 'reconciled'
        logger.info(f"[CLOSE_PERIOD] Step 1: Updating matched transactions to reconciled for period {period}")
        db.execute(
            update(UnreconciledTransaction)
            .where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "matched",
            )
            .values(status="reconciled")
        )

        # Step 2: Copy 'reconciled' transactions to Transaction table using INSERT...SELECT
        logger.info(f"[CLOSE_PERIOD] Step 2: Copying reconciled transactions to Transaction table")
        copy_result = db.execute(
            text("""
            INSERT INTO transactions
            SELECT *
            FROM unreconciled_transactions
            WHERE action_period = :period_int AND status = 'reconciled'
            """),
            {"period_int": period_int}
        )
        reconciled_count = copy_result.rowcount or 0
        logger.info(f"[CLOSE_PERIOD] Copied {reconciled_count} transactions to Transaction table")

        # Step 3: Delete 'reconciled' transactions from UnreconciledTransaction
        logger.info(f"[CLOSE_PERIOD] Step 3: Deleting reconciled transactions from UnreconciledTransaction")
        db.execute(
            delete(UnreconciledTransaction).where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "reconciled",
            )
        )

        # Step 4: Update action_period of remaining unreconciled transactions to new period
        logger.info(f"[CLOSE_PERIOD] Step 4: Updating action_period for remaining unreconciled transactions")
        new_period = _next_period(period)
        new_period_int = int(new_period)
        
        remaining_result = db.execute(
            update(UnreconciledTransaction)
            .where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "unreconciled",
            )
            .values(action_period=new_period_int)
        )
        remaining_count = remaining_result.rowcount or 0
        logger.info(f"[CLOSE_PERIOD] Updated {remaining_count} unreconciled transactions to period {new_period}")

        # Step 5: Update period status to 'closed'
        logger.info(f"[CLOSE_PERIOD] Step 5: Setting period status to closed")
        current.status = "closed"
        db.merge(current)

        # Step 6: Create next period if it doesn't exist
        logger.info(f"[CLOSE_PERIOD] Step 6: Creating next period if needed")
        next_row = db.get(FinancialPeriod, new_period)
        created = False

        if not next_row:
            db.add(_new_period_row(new_period))
            created = True
            logger.info(f"[CLOSE_PERIOD] Created new period {new_period}")
        else:
            logger.info(f"[CLOSE_PERIOD] Period {new_period} already exists")

        # Commit all changes as a single transaction
        db.commit()

        logger.info(
            f"[CLOSE_PERIOD] ✓ SUCCESS: Period {period} closed successfully. "
            f"Moved {reconciled_count} reconciled transactions to Transaction table. "
            f"Updated {remaining_count} unreconciled transactions. "
            f"Created new period {new_period}: {created}"
        )

        return period, new_period, created

    except HTTPException:
        db.rollback()
        logger.warning(f"[CLOSE_PERIOD] Validation error - transaction rolled back: {str(e)}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            f"[CLOSE_PERIOD] ✗ FAILED: Error closing period {period}: {str(e)}", 
            exc_info=True
        )
        raise HTTPException(
            status_code=500, 
            detail=f"Error closing period {period}: {str(e)}"
        )


def _update_financial_period_totals(db: Session, period_int: int) -> None:
    """Update FinancialPeriod totals and counters for the period."""
    try:
        bank_total = db.scalar(
            select(func.coalesce(func.sum(ImportedFile.balance), 0)).where(
                ImportedFile.period == period_int,
                ImportedFile.source == "Bank",
            )
        )

        bank_count = db.scalar(
            select(func.coalesce(func.sum(ImportedFile.record_count), 0)).where(
                ImportedFile.period == period_int,
                ImportedFile.source == "Bank",
            )
        )

        system_total = db.scalar(
            select(func.coalesce(func.sum(ImportedFile.balance), 0)).where(
                ImportedFile.period == period_int,
                ImportedFile.source == "System",
            )
        )

        system_count = db.scalar(
            select(func.coalesce(func.sum(ImportedFile.record_count), 0)).where(
                ImportedFile.period == period_int,
                ImportedFile.source == "System",
            )
        )

        

        matched_total = db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                UnreconciledTransaction.Source == "Bank",
                                UnreconciledTransaction.Amount,
                            ),
                            else_=UnreconciledTransaction.Amount * -1,
                        )
                    ),
                    0,
                )
            ).where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "matched",
            )
        )

        matched_count = db.scalar(
            select(func.coalesce(func.count(UnreconciledTransaction.id), 0)).where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "matched",
            )
        )

        reconciled_total = db.scalar(
            select(func.coalesce(func.sum(UnreconciledTransaction.Amount), 0)).where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "reconciled",
            )
        )

        reconciled_count = db.scalar(
            select(func.coalesce(func.count(UnreconciledTransaction.id), 0)).where(
                UnreconciledTransaction.action_period == period_int,
                UnreconciledTransaction.status == "reconciled",
            )
        )

        db.execute(
            update(FinancialPeriod)
            .where(FinancialPeriod.period == period_int)
            .values(
                bank_total=float(bank_total or 0),
                bank_count=int(bank_count or 0),
                system_total=float(system_total or 0),
                system_count=int(system_count or 0),
                matched_total=float(matched_total or 0),
                matched_count=int(matched_count or 0),
                reconciled_count=int(reconciled_count or 0),
                reconciled_total=float(reconciled_total or 0),
            )
        )
        db.commit()
    except Exception as e:
        logger.error(f"Error updating financial period totals: {str(e)}", exc_info=True)


def activate_period(db: Session, period: str) -> FinancialPeriod:
    target = db.get(FinancialPeriod, period)
    if not target:
        raise HTTPException(status_code=404, detail=f"Period {period} was not found.")

    active_rows = db.scalars(
        select(FinancialPeriod).where(FinancialPeriod.status == "Active")
    )
    for row in active_rows:
        if row.period != period:
            row.status = "Open"

    target.status = "Active"

    period_int = int(period)
    db.commit()
    db.refresh(target)

    _update_financial_period_totals(db, period_int)
    db.refresh(target)

    db.execute(
        update(MatchTypeSetting).values(
            total_count=0,
            total_amount=0,
            elapsed_time=0,
        )
    )
    db.commit()

    return target


def open_period(db: Session, period: str) -> str:
    current = db.get(FinancialPeriod, period)
    if not current:
        raise HTTPException(status_code=404, detail=f"Period {period} was not found.")

    current.status = "Open"
    period_int = int(period)

    db.execute(
        update(MatchTypeSetting).values(
            total_count=0,
            total_amount=0,
            elapsed_time=0,
        )
    )
    db.commit()

    db.execute(
        update(FinancialPeriod)
        .where(FinancialPeriod.period == period)
        .values(
            matched_count=0,
            matched_total=0,
        )
    )
    db.commit()

    db.execute(
        update(UnreconciledTransaction)
        .values(
            MatchType="",
            status="unreconciled",
        )
    )
    db.commit()

    _update_financial_period_totals(db, period_int)

    return f"Period {period} rolled back to open successfully."


def get_latest_period(db: Session) -> FinancialPeriod | None:
    return db.scalar(
        select(FinancialPeriod).order_by(desc(FinancialPeriod.period)).limit(1)
    )


def get_latest_periods(db: Session, limit: int = 12) -> list[FinancialPeriod]:
    return list(
        db.scalars(
            select(FinancialPeriod).order_by(desc(FinancialPeriod.period)).limit(limit)
        )
    )
