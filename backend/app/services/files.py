"""
File import/export service for handling CSV file operations and transactions.
"""

import csv
import logging
import sys
from io import StringIO

from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, desc, func, select, update
from sqlalchemy.orm import Session

from ..models import ImportedFile, UnreconciledTransaction, FinancialPeriod, Transaction
from .periods import _get_current_open_period_int, _get_current_working_period_int

logger = logging.getLogger("app.services")


def get_transaction_file_summaries(db: Session, source: str) -> list[dict[str, object]]:
    """Get a list of imported files for a given source (Bank or System)."""
    normalized = source.strip().lower()
    if normalized not in {"bank", "system"}:
        raise HTTPException(
            status_code=400, detail="Source must be 'Bank' or 'System'."
        )

    db_source = "Bank" if normalized == "bank" else "System"

    # Get current working period (open or active), return empty list if none exists
    current_period_int = _get_current_working_period_int(db)
    if current_period_int is None:
        return []

    # Query ImportedFile table directly - no join needed since all metadata is stored there
    rows = db.execute(
        select(
            ImportedFile.filename.label("FileOrigin"),
            ImportedFile.file_index.label("file_index"),
            ImportedFile.record_count.label("item_count"),
            ImportedFile.balance.label("total_amount"),
        )
        .where(
            ImportedFile.source == db_source,
            ImportedFile.period == current_period_int,
        )
        .order_by(desc(ImportedFile.file_index))
    ).all()

    return [
        {
            "FileOrigin": r.FileOrigin or "",
            "file_index": int(r.file_index or 0),
            "source": db_source,
            "period": current_period_int,
            "item_count": int(r.item_count or 0),
            "total_amount": float(r.total_amount or 0),
        }
        for r in rows
    ]


def import_transactions_csv(
    db: Session, source: str, upload_file: UploadFile, movement_type: str | None = None
) -> dict[str, object]:
    """Import transactions from a CSV file without column mapping."""
    normalized = source.strip().lower()
    if normalized not in {"bank", "system"}:
        raise HTTPException(
            status_code=400, detail="Source must be 'Bank' or 'System'."
        )

    db_source = "Bank" if normalized == "bank" else "System"
    current_period_int = _get_current_open_period_int(db)

    if not upload_file.filename:
        raise HTTPException(status_code=400, detail="A CSV file is required.")

    filename = upload_file.filename
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    raw = upload_file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing.")

    # Create imported file record to get auto-generated file_index
    imported_file = ImportedFile(
        filename=filename, source=db_source, period=current_period_int
    )
    db.add(imported_file)
    db.flush()  # Flush to get the auto-generated file_index
    file_index = imported_file.file_index

    inserted_count = 0
    skipped_count = 0
    total_balance = 0.0
    rows_to_insert: list[UnreconciledTransaction] = []

    for line_no, row in enumerate(reader, start=2):

        def pick(*keys: str) -> str | None:
            for k in keys:
                if k in row and row[k] is not None and str(row[k]).strip() != "":
                    return str(row[k]).strip()
            return None

        # For Bank files with movement_type parameter, use that instead of CSV column
        if movement_type:
            extracted_movement_type = movement_type
        else:
            extracted_movement_type = pick("MovementType", "movement_type")

        # Skip empty lines (LineNo=0 and MovementType is empty)
        if line_no == 0 and not extracted_movement_type:
            skipped_count += 1
            continue

        amount_raw = pick("Amount", "amount") or "0"
        try:
            amount = float(amount_raw.replace(",", ""))
        except ValueError:
            amount = 0.0

        # Skip Bank records with Amount=0
        if db_source == "Bank" and amount == 0:
            skipped_count += 1
            continue

        # Track balance for inserted records
        total_balance += amount

        txn = UnreconciledTransaction(
            RecordId=pick("RecordId", "record_id", "id") or "0",
            Amount=amount,
            Source=db_source,
            PolicyNo=pick("PolicyNo", "policy_no", "policy"),
            FileOrigin=filename,
            FileIndex=file_index,
            LineNo=line_no,
            MovementType=extracted_movement_type,
            Reference=(
                pick("Reference", "reference", "Description", "description") or ""
            )[:255],
            status="unreconciled",
            period=current_period_int,
            MatchType=None,
            MatchId=0,
            action_period=current_period_int,
        )
        rows_to_insert.append(txn)
        inserted_count += 1

    if inserted_count == 0:
        raise HTTPException(status_code=400, detail="No transaction rows found in CSV.")

    db.add_all(rows_to_insert)
    db.flush()

    # Update ImportedFile record with final counts
    imported_file.record_count = inserted_count
    imported_file.balance = total_balance

    # Recalculate period totals and commit everything together
    db.execute(
        update(FinancialPeriod)
        .where(FinancialPeriod.period == str(current_period_int).zfill(6))
        .values(
            system_total=func.coalesce(
                select(func.sum(ImportedFile.balance))
                .where(
                    (ImportedFile.period == current_period_int)
                    & (ImportedFile.source == "System")
                )
                .correlate(None)
                .scalar_subquery(),
                0,
            ),
            bank_total=func.coalesce(
                select(func.sum(ImportedFile.balance))
                .where(
                    (ImportedFile.period == current_period_int)
                    & (ImportedFile.source == "Bank")
                )
                .correlate(None)
                .scalar_subquery(),
                0,
            ),
        )
    )

    db.commit()

    return {
        "source": db_source,
        "period": current_period_int,
        "FileOrigin": filename,
        "file_index": file_index,
        "inserted_count": inserted_count,
        "skipped_count": skipped_count,
    }


def delete_transactions_file(
    db: Session, source: str, file_origin: str, file_index: int
) -> dict[str, object]:
    """Delete transactions and imported file record for a given file."""
    print("Deleting transactions for file:", source, file_origin, file_index)
    normalized = source.strip().lower()
    if normalized not in {"bank", "system"}:
        raise HTTPException(
            status_code=400, detail="Source must be 'Bank' or 'System'."
        )
    if not file_origin.strip():
        raise HTTPException(status_code=400, detail="file_origin is required.")
    if file_index < 1:
        raise HTTPException(status_code=400, detail="file_index must be >= 1.")

    db_source = "Bank" if normalized == "bank" else "System"
    current_period_int = _get_current_working_period_int(db)

    if current_period_int is None:
        raise HTTPException(
            status_code=409, detail="No open or active financial period available."
        )

    stmt = delete(UnreconciledTransaction).where(
        UnreconciledTransaction.Source == db_source,
        UnreconciledTransaction.period == current_period_int,
        UnreconciledTransaction.FileIndex == file_index,
    )
    result = db.execute(stmt)
    deleted_count = int(result.rowcount or 0)
    print("Deleted transactions count:", deleted_count)

    # Also delete the corresponding ImportedFile record
    stmt_file = delete(ImportedFile).where(
        ImportedFile.file_index == file_index,
    )
    result = db.execute(stmt_file)
    deleted_count = int(result.rowcount or 0)
    print("Deleted File count:", deleted_count)

    if deleted_count == 0:
        raise HTTPException(
            status_code=404, detail="No transactions found for selected file."
        )

    db.commit()

    return {
        "source": db_source,
        "period": current_period_int,
        "FileOrigin": file_origin,
        "file_index": file_index,
        "deleted_count": deleted_count,
    }


def preview_csv_file(upload_file: UploadFile) -> dict[str, object]:
    """Preview CSV file by returning columns and first 5 + last 5 rows."""
    if not upload_file.filename:
        raise HTTPException(status_code=400, detail="A CSV file is required.")

    filename = upload_file.filename
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    raw = upload_file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing.")

    columns = list(reader.fieldnames)
    all_rows = []
    top_rows = []
    bottom_rows = []

    # Read all rows to get top and bottom
    for row in reader:
        all_rows.append(row)
        if len(top_rows) < 5:  # Collect first 5 rows
            top_rows.append(row)

    # Get the last 5 rows (if there are more than 5 total rows)
    if len(all_rows) > 5:
        bottom_rows = all_rows[-5:]

    # Combine top and bottom rows for preview
    preview_rows = top_rows.copy()
    if len(all_rows) > 5:
        preview_rows.append({col: "..." for col in columns})  # Add separator row
        preview_rows.extend(bottom_rows)

    return {
        "columns": columns,
        "preview_rows": preview_rows,
        "total_rows": len(all_rows),
    }


def _apply_transformation(
    value: str, transformation: str, row: dict = None
) -> str | None:
    """
    Apply a transformation function to a value.
    Transformations can be chained using semicolon (;) delimiter.

    IMPORTANT: skip_if transformations are ALWAYS evaluated first, regardless of order.
    This ensures rows are skipped before any other transformations are applied.

    Supported transformations:
    - skip_if:match_value: Skip row if value matches (EVALUATED FIRST)
    - skip_if:empty: Skip row if value is empty or blank (EVALUATED FIRST)
    - negate_if:match_value: Negate Amount if field value matches (can be on any field)
    - convert_negative / abs: Convert negative to positive
    - uppercase: Convert to uppercase
    - trim: Remove whitespace
    - substring:start,end: Extract substring
    - left_of:chars: Extract text to the left of chars
    - change_value:new_value: Replace with a constant value
    - replace_if:findvalue=replacevalue: Replace if value matches

    Returns None to signal that the row should be skipped.
    Raises HTTPException with detailed error messages on transformation errors.
    """
    if not transformation or not value:
        return value

    transform_str = str(value).strip()
    transformations = [t.strip() for t in transformation.split(";")]

    # FIRST PASS: Check all skip_if conditions BEFORE applying any other transformations
    for transform in transformations:
        if not transform or not transform.startswith("skip_if:"):
            continue

        skip_value = transform[8:]
        if not skip_value:
            raise HTTPException(
                status_code=400,
                detail=f"Transformation 'skip_if' requires a value. Format: skip_if:VALUE (e.g., skip_if:SKIP) or skip_if:empty. Got: '{transform}'",
            )

        # Check for special case: skip_if:empty (skips if value is empty/blank)
        if skip_value.lower() == "empty":
            if not transform_str or transform_str.strip() == "":
                return None  # Signal to skip this row immediately
        # Check against original value for skip_if with specific value
        elif transform_str == skip_value:
            return None  # Signal to skip this row immediately

    # SECOND PASS: Apply all other transformations
    result = transform_str

    for idx, transform in enumerate(transformations):
        if (
            not transform
            or transform.startswith("skip_if:")
            or transform.startswith("negate_if:")
        ):
            # Skip the skip_if and negate_if transformations (already handled elsewhere)
            continue

        try:
            if transform in ("convert_negative", "abs"):
                try:
                    num = float(result)
                    result = str(abs(num))
                except (ValueError, TypeError) as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation '{transform}' failed: Cannot convert '{result}' to number. Original value: '{value}'",
                    )

            elif transform == "uppercase":
                result = result.upper()

            elif transform == "trim":
                result = result.strip()

            elif transform.startswith("substring:"):
                try:
                    parts = transform[10:].split(",")
                    if len(parts) < 1 or not parts[0].strip():
                        raise HTTPException(
                            status_code=400,
                            detail=f"Transformation 'substring' requires format: substring:start,end (e.g., substring:0,5). Got: '{transform}'",
                        )

                    start = int(parts[0].strip())
                    end = (
                        int(parts[1].strip())
                        if len(parts) > 1 and parts[1].strip()
                        else len(result)
                    )

                    if start < 0 or end < 0:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Transformation 'substring' indices must be non-negative. Got start={start}, end={end}",
                        )

                    if start > end:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Transformation 'substring' start index ({start}) cannot be greater than end index ({end})",
                        )

                    result = result[start:end]
                except ValueError as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation 'substring' requires numeric indices. Format: substring:start,end (e.g., substring:0,5). Got: '{transform}'. Error: {str(e)}",
                    )

            elif transform.startswith("left_of:"):
                chars = transform[8:]
                if not chars:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation 'left_of' requires a delimiter. Format: left_of:DELIMITER (e.g., left_of:C1). Got: '{transform}'",
                    )
                index = result.find(chars)
                if index == -1:
                    logger.warning(
                        f"Transformation 'left_of:{chars}' did not find delimiter in value '{result}'. Returning '0'."
                    )
                    result = "0"
                else:
                    result = result[:index]

            elif transform.startswith("change_value:"):
                new_value = transform[13:]
                if not new_value:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation 'change_value' requires a value. Format: change_value:VALUE (e.g., change_value:NEW). Got: '{transform}'",
                    )
                result = new_value

            elif transform.startswith("replace_if:"):
                replacement = transform[11:]
                if not replacement or "=" not in replacement:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation 'replace_if' requires format: replace_if:findvalue=replacevalue (e.g., replace_if:OLD=NEW). Got: '{transform}'",
                    )
                find_value, replace_value = replacement.split("=", 1)
                if not find_value:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Transformation 'replace_if' find value cannot be empty. Format: replace_if:findvalue=replacevalue. Got: '{transform}'",
                    )
                # Replace entire value if find_value is found anywhere in result
                if find_value in result:
                    result = replace_value

            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown transformation: '{transform}'. Supported transformations: convert_negative, abs, uppercase, trim, substring:start,end, skip_if:value, skip_if:empty, negate_if:value, left_of:chars, change_value:value, replace_if:findvalue=replacevalue",
                )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Unexpected error in transformation '{transform}': {str(e)}. Original value: '{value}'",
            )

    return result


def import_transactions_csv_with_mapping(
    db: Session,
    source: str,
    upload_file: UploadFile,
    column_mapping: dict[str, str],
    column_transformations: dict[str, str] | None = None,
) -> dict[str, object]:
    """Import CSV file with user-defined column mapping and transformations."""
    normalized = source.strip().lower()
    if normalized not in {"bank", "system"}:
        raise HTTPException(
            status_code=400, detail="Source must be 'Bank' or 'System'."
        )

    db_source = "Bank" if normalized == "bank" else "System"
    current_period_int = _get_current_open_period_int(db)

    if not upload_file.filename:
        raise HTTPException(status_code=400, detail="A CSV file is required.")

    filename = upload_file.filename
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    raw = upload_file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing.")

    # Validate that all required columns exist in the CSV
    available_columns = set(reader.fieldnames)
    required_mappings = ["MovementType", "PolicyNo", "Amount", "Reference"]

    for required in required_mappings:
        if required not in column_mapping or not column_mapping[required]:
            raise HTTPException(
                status_code=400, detail=f"Column mapping for '{required}' is required."
            )
        if column_mapping[required] not in available_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{column_mapping[required]}' not found in CSV.",
            )

    max_file_index = db.scalar(
        select(func.coalesce(func.max(Transaction.FileIndex), 0)).where(
            Transaction.period == current_period_int,
        )
    )
    file_index = int(max_file_index or 0) + 1

    inserted_count = 0
    skipped_count = 0
    rows_to_insert: list[UnreconciledTransaction] = []

    # Create ImportedFile record to get auto-generated file_index
    imported_file = ImportedFile(
        filename=filename, source=db_source, period=current_period_int
    )
    db.add(imported_file)
    db.flush()
    file_index = imported_file.file_index
    total_balance = 0.0

    # Extract skip_if and negate_if conditions from transformations BEFORE the loop
    skip_if_conditions = {
        "MovementType": [],
        "PolicyNo": [],
        "Amount": [],
        "Reference": [],
    }
    skip_if_empty_fields = set()  # Track which fields have skip_if:empty

    negate_if_conditions = {
        "MovementType": [],
        "PolicyNo": [],
        "Amount": [],
        "Reference": [],
    }

    if column_transformations:
        for field, transformation in column_transformations.items():
            if transformation and field in skip_if_conditions:
                transformations = transformation.split(";")
                for transform in transformations:
                    transform = transform.strip()
                    if transform.startswith("skip_if:"):
                        skip_value = transform[8:]
                        if skip_value.lower() == "empty":
                            skip_if_empty_fields.add(field)
                        else:
                            skip_if_conditions[field].append(skip_value)
                    elif transform.startswith("negate_if:"):
                        negate_value = transform[10:]
                        negate_if_conditions[field].append(
                            negate_value
                        )  # Reset the file reader to start from beginning
    raw = upload_file.file.read() if hasattr(upload_file, "file") else raw
    upload_file.file.seek(0)
    raw = upload_file.file.read()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(StringIO(text))

    debug_rows = []  # Store first 5 rows for debug output
    for line_no, row in enumerate(reader, start=2):
        # Extract values using the column mapping
        extracted_movement_type = row.get(column_mapping["MovementType"], "").strip()
        policy_no = row.get(column_mapping["PolicyNo"], "").strip()
        amount_raw = row.get(column_mapping["Amount"], "0")
        reference = row.get(column_mapping["Reference"], "").strip()

        # Check skip_if conditions on original values - skip row if any condition matches
        should_skip_row = False
        if extracted_movement_type in skip_if_conditions["MovementType"]:
            should_skip_row = True
        elif policy_no in skip_if_conditions["PolicyNo"]:
            should_skip_row = True
        elif amount_raw in skip_if_conditions["Amount"]:
            should_skip_row = True
        elif reference in skip_if_conditions["Reference"]:
            should_skip_row = True
        # Check skip_if:empty conditions
        elif "MovementType" in skip_if_empty_fields and not extracted_movement_type:
            should_skip_row = True
        elif "PolicyNo" in skip_if_empty_fields and not policy_no:
            should_skip_row = True
        elif "Amount" in skip_if_empty_fields and not amount_raw:
            should_skip_row = True
        elif "Reference" in skip_if_empty_fields and not reference:
            should_skip_row = True

        if should_skip_row:
            skipped_count += 1
            continue

        # Check negate_if conditions on original field values BEFORE transformations
        # negate_if can be on any field but always negates the Amount
        should_negate_amount = False
        if extracted_movement_type in negate_if_conditions["MovementType"]:
            should_negate_amount = True
        elif policy_no in negate_if_conditions["PolicyNo"]:
            should_negate_amount = True
        elif amount_raw in negate_if_conditions["Amount"]:
            should_negate_amount = True
        elif reference in negate_if_conditions["Reference"]:
            should_negate_amount = True
            should_negate_amount = True

        # Apply transformations if provided
        if column_transformations:
            try:

                if column_transformations.get("MovementType"):
                    extracted_movement_type = _apply_transformation(
                        extracted_movement_type, column_transformations["MovementType"]
                    )
                    if extracted_movement_type is None:
                        skipped_count += 1
                        continue
                    extracted_movement_type = str(extracted_movement_type).strip()

                if column_transformations.get("PolicyNo"):
                    policy_no = _apply_transformation(
                        policy_no, column_transformations["PolicyNo"]
                    )
                    if policy_no is None:
                        skipped_count += 1
                        continue
                    policy_no = str(policy_no).strip()

                if column_transformations.get("Amount"):
                    amount_raw = _apply_transformation(
                        amount_raw, column_transformations["Amount"]
                    )
                    if amount_raw is None:
                        skipped_count += 1
                        continue
                    amount_raw = str(amount_raw).strip()

                if column_transformations.get("Reference"):
                    reference = _apply_transformation(
                        reference, column_transformations["Reference"]
                    )
                    if reference is None:
                        skipped_count += 1
                        continue
                    reference = str(reference).strip()

            except HTTPException as e:

                raise HTTPException(
                    status_code=400,
                    detail=f"Row {line_no} transformation error: {e.detail}",
                )

        # Skip empty lines (LineNo=0 and MovementType is empty)
        if line_no == 0 and not extracted_movement_type:
            skipped_count += 1
            continue

        try:
            amount = float(amount_raw.replace(",", "")) if amount_raw else 0.0
        except ValueError:
            amount = 0.0

        # Apply negate_if after amount conversion but before balance tracking
        if should_negate_amount:
            amount = -amount

        # Track balance for inserted records
        total_balance += amount

        txn = UnreconciledTransaction(
            RecordId=policy_no or "0",
            Amount=amount,
            Source=db_source,
            PolicyNo=policy_no,
            FileOrigin=filename,  # Store the actual uploaded filename
            FileIndex=file_index,
            LineNo=line_no,
            MovementType=extracted_movement_type,
            Reference=reference[:255],  # Truncate to column length
            status="unreconciled",
            period=current_period_int,
            MatchType=None,
            MatchId=0,
            action_period=current_period_int,
        )
        rows_to_insert.append(txn)
        inserted_count += 1

    if inserted_count == 0:
        raise HTTPException(status_code=400, detail="No transaction rows found in CSV.")

    db.add_all(rows_to_insert)
    db.flush()

    # Update ImportedFile record with final counts
    imported_file.record_count = inserted_count
    imported_file.balance = total_balance

    db.commit()

    # Recalculate period totals after import
    from .periods import _update_financial_period_totals
    _update_financial_period_totals(db, current_period_int)

    print("\n" + "=" * 100 + "\n")

    return {
        "source": db_source,
        "period": current_period_int,
        "FileOrigin": filename,
        "file_index": file_index,
        "inserted_count": inserted_count,
        "skipped_count": skipped_count,
    }
