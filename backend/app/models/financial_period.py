"""Financial period model for tracking period-level reconciliation data."""
from __future__ import annotations

from sqlalchemy import DateTime, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class FinancialPeriod(Base):
    __tablename__ = "financial_periods"

    period: Mapped[str] = mapped_column(String(7), primary_key=True)
    bank_total: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    bank_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    system_total: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    system_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bbf_total: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    bbf_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    matched_total: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    matched_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reconciled_total: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    reconciled_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=True, default="open", server_default=text("'open'")
    )
    last_updated: Mapped[str] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )
