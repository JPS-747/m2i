"""Financial period schemas."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PeriodBaseRequest(BaseModel):
    period: str = Field(
        ..., description="Financial period in YYYYMM format, e.g. 202603"
    )


class ClosePeriodRequest(PeriodBaseRequest):
    pass


class ActivatePeriodRequest(PeriodBaseRequest):
    pass


class OpenPeriodRequest(PeriodBaseRequest):
    pass


class FinancialPeriodResponse(BaseModel):
    period: str
    bank_total: Decimal
    bank_count: int | None
    system_total: Decimal
    system_count: int | None
    bbf_total: Decimal
    bbf_count: int | None
    matched_total: Decimal | None
    matched_count: int | None
    reconciled_total: Decimal
    reconciled_count: int
    status: str | None
    last_updated: datetime

    model_config = {"from_attributes": True}


class ClosePeriodResponse(BaseModel):
    closed_period: str
    new_period: str
    new_period_created: bool
