"""Transaction endpoints for querying unreconciled and historical transaction data."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models import UnreconciledTransaction, Transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/unreconciled")
def get_unreconciled_transactions(
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    status: str = "",
    source: str = "",
    policy_no: str = "",
    period: str = "",
    sort_key: str = "",
    sort_direction: str = "asc",
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """
    Get paginated unreconciled transactions from UnreconciledTransaction table
    with optional search, filters, and sorting

    Args:
        page: Page number (1-indexed), default 1
        page_size: Number of records per page, default 100, max 500
        search: Search term to query against ID, PolicyNo, Reference, FileOrigin, MatchType
        status: Filter by status (unreconciled, reconciled)
        source: Filter by source (Bank, System)
        policy_no: Filter by exact PolicyNo match
        period: Filter by exact period match
        sort_key: Column to sort by (e.g., 'id', 'Amount', 'PolicyNo', 'PolicyNoCount', 'created_at')
        sort_direction: Sort direction ('asc' or 'desc')
    """
    print(
        f"\n[ENDPOINT HIT] GET /transactions/unreconciled - page={page}, page_size={page_size}, search='{search}', status='{status}', source='{source}', policy_no='{policy_no}', period='{period}', sort_key='{sort_key}', sort_direction='{sort_direction}'\n"
    )
    try:
        # Enforce maximum page size to prevent memory issues
        page_size = min(page_size, 500)
        page = max(page, 1)

        conditions = [UnreconciledTransaction.status == "unreconciled"]

        # Build query with optional search filter
        query = db.query(UnreconciledTransaction)

        # Apply search filter if provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (UnreconciledTransaction.id.ilike(search_term))
                | (UnreconciledTransaction.PolicyNo.ilike(search_term))
                | (UnreconciledTransaction.Reference.ilike(search_term))
                | (UnreconciledTransaction.FileOrigin.ilike(search_term))
                | (UnreconciledTransaction.MatchType.ilike(search_term))
                | (UnreconciledTransaction.Amount == search)
            )

            if conditions:
                query = (
                    query.where(and_(*conditions))
                    if len(conditions) > 1
                    else query.where(conditions[0])
                )

        # Apply status filter if provided
        if status:
            query = query.filter(UnreconciledTransaction.status == status)

        # Apply source filter if provided
        if source:
            query = query.filter(UnreconciledTransaction.Source == source)

        # Apply PolicyNo filter if provided
        if policy_no:
            query = query.filter(UnreconciledTransaction.PolicyNo == policy_no)

        # Apply period filter if provided
        if period:
            query = query.filter(UnreconciledTransaction.period == int(period))

        # Get total count with all filters applied
        total_count = query.count()

        # Calculate total amount across all filtered records
        # Use CASE statement to negate amount for System source
        total_amount_result = db.query(
            func.sum(
                case(
                    (
                        UnreconciledTransaction.Source == "System",
                        -UnreconciledTransaction.Amount,
                    ),
                    else_=UnreconciledTransaction.Amount,
                )
            )
        )

        # Apply search if provided
        if search:
            search_term = f"%{search}%"
            total_amount_result = total_amount_result.filter(
                (UnreconciledTransaction.id.ilike(search_term))
                | (UnreconciledTransaction.PolicyNo.ilike(search_term))
                | (UnreconciledTransaction.Reference.ilike(search_term))
                | (UnreconciledTransaction.FileOrigin.ilike(search_term))
                | (UnreconciledTransaction.MatchType.ilike(search_term))
                | (UnreconciledTransaction.Amount == search)
            )

        # Apply the same filters to total amount calculation
        if status:
            total_amount_result = total_amount_result.filter(
                UnreconciledTransaction.status == status
            )
        if source:
            total_amount_result = total_amount_result.filter(
                UnreconciledTransaction.Source == source
            )
        if policy_no:
            total_amount_result = total_amount_result.filter(
                UnreconciledTransaction.PolicyNo == policy_no
            )
        if period:
            total_amount_result = total_amount_result.filter(
                UnreconciledTransaction.period == int(period)
            )
        print(total_amount_result)

        total_amount = float(total_amount_result.scalar() or 0)

        # Debug logging
        print(
            f"[DEBUG] Total amount query result: {total_amount_result.scalar()}, converted: {total_amount}"
        )

        # Calculate offset
        offset = (page - 1) * page_size

        # Apply sorting if specified
        if sort_key:
            # Map column names to model attributes
            sort_columns = {
                "id": UnreconciledTransaction.id,
                "Amount": UnreconciledTransaction.Amount,
                "Source": UnreconciledTransaction.Source,
                "PolicyNo": UnreconciledTransaction.PolicyNo,
                "FileOrigin": UnreconciledTransaction.FileOrigin,
                "MovementType": UnreconciledTransaction.MovementType,
                "Reference": UnreconciledTransaction.Reference,
                "status": UnreconciledTransaction.status,
                "period": UnreconciledTransaction.period,
                "MatchType": UnreconciledTransaction.MatchType,
                "created_at": UnreconciledTransaction.created_at,
            }

            if sort_key in sort_columns:
                sort_column = sort_columns[sort_key]
                if sort_direction.lower() == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())

        # Fetch paginated results
        transactions = query.offset(offset).limit(page_size).all()

        # Log the actual SQL query executed
        compiled_query = query.statement.compile(compile_kwargs={"literal_binds": True})
        print(f"\n[SQL Query Executed]\n{compiled_query}\n")

        # Convert to dictionary format
        transactions_data = [
            {
                "id": txn.id,
                "Amount": float(txn.Amount or 0),
                "Source": txn.Source,
                "PolicyNo": txn.PolicyNo,
                "FileOrigin": txn.FileOrigin,
                "FileIndex": txn.FileIndex,
                "LineNo": txn.LineNo,
                "MovementType": txn.MovementType,
                "Reference": txn.Reference,
                "status": txn.status,
                "period": txn.period,
                "action_period": txn.action_period,
                "MatchType": txn.MatchType or "",
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            }
            for txn in transactions
        ]

        total_pages = (total_count + page_size - 1) // page_size

        return {
            "transactions": transactions_data,
            "count": len(transactions_data),
            "total_count": total_count,
            "total_amount": total_amount,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "search": search,
            "status": "success",
        }
    except Exception as e:
        print(f"Error fetching unreconciled transactions: {str(e)}")
        return {
            "transactions": [],
            "count": 0,
            "total_count": 0,
            "status": "error",
            "message": str(e),
        }


@router.get("/history")
def get_transaction_history(
    page: int = 1,
    page_size: int = 100,
    search: str = "",
    status: str = "",
    source: str = "",
    policy_no: str = "",
    period: str = "",
    sort_key: str = "",
    sort_direction: str = "asc",
    db: Session = Depends(get_db),
) -> dict[str, object]:
    """
    Get paginated transaction history from Transaction table
    with optional search, filters, and sorting

    Args:
        page: Page number (1-indexed), default 1
        page_size: Number of records per page, default 100, max 500
        search: Search term to query against ID, PolicyNo, Reference, FileOrigin, MatchType
        status: Filter by status (unreconciled, reconciled)
        source: Filter by source (Bank, System)
        policy_no: Filter by exact PolicyNo match
        period: Filter by exact period match
        sort_key: Column to sort by (e.g., 'id', 'Amount', 'PolicyNo', 'created_at')
        sort_direction: Sort direction ('asc' or 'desc')
    """
    print(
        f"\n[ENDPOINT HIT] GET /transactions/history - page={page}, page_size={page_size}, search='{search}', status='{status}', source='{source}', policy_no='{policy_no}', period='{period}', sort_key='{sort_key}', sort_direction='{sort_direction}'\n"
    )
    try:
        # Enforce maximum page size to prevent memory issues
        page_size = min(page_size, 500)
        page = max(page, 1)

        # Build query with optional search filter
        query = db.query(Transaction)

        # Apply search filter if provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Transaction.id.ilike(search_term))
                | (Transaction.PolicyNo.ilike(search_term))
                | (Transaction.Reference.ilike(search_term))
                | (Transaction.FileOrigin.ilike(search_term))
                | (Transaction.MatchType.ilike(search_term))
                | (Transaction.Amount == search)
            )

        # Apply status filter if provided
        if status:
            query = query.filter(Transaction.status == status)

        # Apply source filter if provided
        if source:
            query = query.filter(Transaction.Source == source)

        # Apply PolicyNo filter if provided
        if policy_no:
            query = query.filter(Transaction.PolicyNo == policy_no)

        # Apply period filter if provided
        if period:
            query = query.filter(Transaction.period == int(period))

        # Get total count with all filters applied
        total_count = query.count()

        # Calculate total amount across all filtered records
        # Use CASE statement to negate amount for System source
        total_amount_result = db.query(
            func.sum(
                case(
                    (Transaction.Source == "System", -Transaction.Amount),
                    else_=Transaction.Amount,
                )
            )
        )

        # Apply search if provided
        if search:
            search_term = f"%{search}%"
            total_amount_result = total_amount_result.filter(
                (Transaction.id.ilike(search_term))
                | (Transaction.PolicyNo.ilike(search_term))
                | (Transaction.Reference.ilike(search_term))
                | (Transaction.FileOrigin.ilike(search_term))
                | (Transaction.MatchType.ilike(search_term))
                | (Transaction.Amount == search)
            )

        # Apply the same filters to total amount calculation
        if status:
            total_amount_result = total_amount_result.filter(
                Transaction.status == status
            )
        if source:
            total_amount_result = total_amount_result.filter(
                Transaction.Source == source
            )
        if policy_no:
            total_amount_result = total_amount_result.filter(
                Transaction.PolicyNo == policy_no
            )
        if period:
            total_amount_result = total_amount_result.filter(
                Transaction.period == int(period)
            )
        print(total_amount_result)

        total_amount = float(total_amount_result.scalar() or 0)

        # Debug logging
        print(
            f"[DEBUG] Total amount query result: {total_amount_result.scalar()}, converted: {total_amount}"
        )

        # Calculate offset
        offset = (page - 1) * page_size

        # Apply sorting if specified
        if sort_key:
            # Map column names to model attributes
            sort_columns = {
                "id": Transaction.id,
                "Amount": Transaction.Amount,
                "Source": Transaction.Source,
                "PolicyNo": Transaction.PolicyNo,
                "FileOrigin": Transaction.FileOrigin,
                "MovementType": Transaction.MovementType,
                "Reference": Transaction.Reference,
                "status": Transaction.status,
                "period": Transaction.period,
                "MatchType": Transaction.MatchType,
                "created_at": Transaction.created_at,
            }

            if sort_key in sort_columns:
                sort_column = sort_columns[sort_key]
                if sort_direction.lower() == "desc":
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())

        # Fetch paginated results
        transactions = query.offset(offset).limit(page_size).all()

        # Log the actual SQL query executed
        compiled_query = query.statement.compile(compile_kwargs={"literal_binds": True})
        print(f"\n[SQL Query Executed]\n{compiled_query}\n")

        # Convert to dictionary format
        transactions_data = [
            {
                "id": txn.id,
                "Amount": float(txn.Amount or 0),
                "Source": txn.Source,
                "PolicyNo": txn.PolicyNo,
                "FileOrigin": txn.FileOrigin,
                "FileIndex": txn.FileIndex,
                "LineNo": txn.LineNo,
                "MovementType": txn.MovementType,
                "Reference": txn.Reference,
                "status": txn.status,
                "period": txn.period,
                "action_period": txn.action_period,
                "MatchType": txn.MatchType or "",
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            }
            for txn in transactions
        ]

        total_pages = (total_count + page_size - 1) // page_size

        return {
            "transactions": transactions_data,
            "count": len(transactions_data),
            "total_count": total_count,
            "total_amount": total_amount,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "search": search,
            "status": "success",
        }
    except Exception as e:
        print(f"Error fetching transaction history: {str(e)}")
        return {
            "transactions": [],
            "count": 0,
            "total_count": 0,
            "status": "error",
            "message": str(e),
        }
