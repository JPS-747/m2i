"""Match type category model for storing match type category metadata."""
from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class MatchTypeCategory(Base):
    __tablename__ = "match_type_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type_key: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
