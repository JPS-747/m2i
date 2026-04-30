"""File-related schemas."""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class TransactionFileSummaryResponse(BaseModel):
    FileOrigin: str
    file_index: int
    source: str
    period: int | None
    item_count: int
    total_amount: Decimal


class FileImportResponse(BaseModel):
    source: str
    period: int
    FileOrigin: str
    file_index: int
    inserted_count: int
    skipped_count: int = 0


class FileDeleteRequest(BaseModel):
    FileOrigin: str
    file_index: int


class FileDeleteResponse(BaseModel):
    source: str
    period: int
    FileOrigin: str
    file_index: int
    deleted_count: int


class FilePreviewResponse(BaseModel):
    columns: list[str]
    preview_rows: list[dict]


class ColumnMappingRequest(BaseModel):
    MovementType: str
    PolicyNo: str
    Amount: str
    Reference: str
