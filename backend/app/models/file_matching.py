"""File matching model for tracking file-based matches."""
from __future__ import annotations

from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class FileMatching(Base):
    __tablename__ = "file_matching"

    id: Mapped[str] = mapped_column(String(150), primary_key=True)
    period: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
