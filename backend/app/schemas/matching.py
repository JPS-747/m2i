"""Matching-related schemas."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FileMatchingRequest(BaseModel):
    ids: list[str]
    idColumn: str


class FileMatchingResponse(BaseModel):
    matched_count: int
    skipped_count: int
    period: int
    idColumn: str


class MatchTypeStatsResponse(BaseModel):
    """Stats only - returned from /match/types endpoint"""

    key: str
    total_count: int
    total_amount: float
    elapsed_time: int
    status: str

    model_config = {"from_attributes": True}


class UpdateMatchTypeSettingsRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    type: str | None = None
    is_active: bool | None = None
    parameters: dict[str, Any] | list[Any] | str | None = None


class UpdateMatchTypeOrderRequest(BaseModel):
    match_type_keys: list[str] = Field(
        ..., description="List of match type keys in desired order"
    )
