"""File management and import routes."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
import json
import logging

from app.database import get_db
from app.schemas import (
    TransactionFileSummaryResponse,
    FilePreviewResponse,
    FileImportResponse,
    FileDeleteRequest,
    FileDeleteResponse,
)
from app.services import (
    get_transaction_file_summaries,
    delete_transactions_file,
    import_transactions_csv_with_mapping,
    preview_csv_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/system", response_model=list[TransactionFileSummaryResponse])
def system_file_summaries(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    """Get summaries of all imported System files."""
    return get_transaction_file_summaries(db, source="System")


@router.get("/bank", response_model=list[TransactionFileSummaryResponse])
def bank_file_summaries(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    """Get summaries of all imported Bank files."""
    return get_transaction_file_summaries(db, source="Bank")


@router.post("/preview", response_model=FilePreviewResponse)
def preview_file(file: UploadFile = File(...)) -> dict[str, object]:
    """Preview a CSV file without importing it."""
    return preview_csv_file(file)


@router.post("/system/import-mapped", response_model=FileImportResponse)
def import_system_file_mapped(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    transformations: str = Form(default="{}"),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Import System file with custom column mapping and transformations."""
    column_mapping = json.loads(mapping)
    column_transformations = json.loads(transformations)
    return import_transactions_csv_with_mapping(
        db,
        source="System",
        upload_file=file,
        column_mapping=column_mapping,
        column_transformations=column_transformations,
    )


@router.post("/bank/import-mapped", response_model=FileImportResponse)
def import_bank_file_mapped(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    transformations: str = Form(default="{}"),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """Import Bank file with custom column mapping and transformations."""
    column_mapping = json.loads(mapping)
    column_transformations = json.loads(transformations)
    return import_transactions_csv_with_mapping(
        db,
        source="Bank",
        upload_file=file,
        column_mapping=column_mapping,
        column_transformations=column_transformations,
    )


@router.post("/system/delete", response_model=FileDeleteResponse)
def delete_system_file(
    payload: FileDeleteRequest, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Delete a System file and its transactions."""
    return delete_transactions_file(
        db,
        source="System",
        file_origin=payload.FileOrigin,
        file_index=payload.file_index,
    )


@router.post("/bank/delete", response_model=FileDeleteResponse)
def delete_bank_file(
    payload: FileDeleteRequest, db: Session = Depends(get_db)
) -> dict[str, object]:
    """Delete a Bank file and its transactions."""
    return delete_transactions_file(
        db,
        source="Bank",
        file_origin=payload.FileOrigin,
        file_index=payload.file_index,
    )
