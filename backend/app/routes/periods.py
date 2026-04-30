"""Period management routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FinancialPeriod
from app.schemas import (
    ActivatePeriodRequest,
    ClosePeriodRequest,
    ClosePeriodResponse,
    OpenPeriodRequest,
    FinancialPeriodResponse,
    MessageResponse,
)
from app.services import (
    activate_period,
    close_period,
    get_latest_period,
    get_latest_periods,
    _update_financial_period_totals,
    open_period,
)

router = APIRouter(prefix="/periods", tags=["periods"])


@router.post("/activate", response_model=FinancialPeriodResponse)
def activate_period_endpoint(
    payload: ActivatePeriodRequest, db: Session = Depends(get_db)
) -> FinancialPeriod:
    """Activate a financial period."""
    return activate_period(db, payload.period)


@router.post("/close", response_model=ClosePeriodResponse)
def close_period_endpoint(
    payload: ClosePeriodRequest, db: Session = Depends(get_db)
) -> ClosePeriodResponse:
    """
    Close a financial period.
    
    Validations:
    - Period must exist and have status='Active'
    - Matched count must be > 30,000
    - Matched total must be = 0 (perfectly balanced)
    
    Operations (if all validations pass):
    - Update all 'matched' transactions to 'reconciled'
    - Copy 'reconciled' transactions to Transaction table
    - Delete 'reconciled' transactions from UnreconciledTransaction
    - Update action_period of remaining 'unreconciled' transactions to new period
    - Create next period if it doesn't exist
    """
    closed_period, new_period, created = close_period(db, payload.period)
    return ClosePeriodResponse(
        closed_period=closed_period,
        new_period=new_period,
        new_period_created=created,
    )


@router.post("/open", response_model=MessageResponse)
def open_period_endpoint(
    payload: OpenPeriodRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    """Open a financial period."""
    message = open_period(db, payload.period)
    return MessageResponse(message=message)


@router.get("/latest", response_model=FinancialPeriodResponse)
def latest_period(db: Session = Depends(get_db)) -> FinancialPeriod:
    """Get the latest financial period."""
    period = get_latest_period(db)
    _update_financial_period_totals(db, period.period)
    print(
        f"Latest period: {period.period}, status: {period.status}, bank_total: {period.bank_total}, system_total: {period.system_total}"
    )
    return period


@router.get("/latest-12", response_model=list[FinancialPeriodResponse])
@router.get("", response_model=list[FinancialPeriodResponse])
def latest_12_periods(db: Session = Depends(get_db)) -> list[FinancialPeriod]:
    """Get the last 12 financial periods."""
    return get_latest_periods(db, limit=12)
