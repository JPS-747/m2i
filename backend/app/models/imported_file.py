"""Imported file model for tracking file imports."""
from __future__ import annotations

from sqlalchemy import DateTime, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ImportedFile(Base):
    __tablename__ = "imported_files"

    file_index: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    record_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    balance: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0.00, server_default=text("0.00")
    )
    created_at: Mapped[str] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
