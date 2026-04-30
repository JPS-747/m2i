"""Unreconciled transaction model for tracking unmatched transactions."""
from __future__ import annotations

import uuid
from sqlalchemy import DateTime, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class UnreconciledTransaction(Base):
    __tablename__ = "unreconciled_transactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    RecordId: Mapped[str | None] = mapped_column(
        String(150), nullable=True, server_default=text("'0'")
    )
    Amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    Source: Mapped[str] = mapped_column(String(50), nullable=False)
    PolicyNo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    FileOrigin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    FileIndex: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    LineNo: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    MovementType: Mapped[str | None] = mapped_column(String(50), nullable=True)
    Reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unreconciled",
        server_default=text("'unreconciled'"),
    )
    period: Mapped[int | None] = mapped_column(Integer, nullable=True)
    MatchType: Mapped[str | None] = mapped_column(String(45), nullable=True)
    MatchId: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    action_period: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
