"""Agent endpoints for querying agent history and activity logs."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_

from app.database import get_db
from app.models import UnreconciledTransaction, Transaction

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/history")
def get_agent_history(
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
    Get paginated agent history with optional search, filters, and sorting

    Args:
        page: Page number (1-indexed), default 1
        page_size: Number of records per page, default 100, max 500
        search: Search term to query against agent_name, action, error_message
        status: Filter by status (pending, running, completed, failed)
        agent_name: Filter by exact agent name match
        action: Filter by exact action match
        period: Filter by exact period match
        sort_key: Column to sort by (e.g., 'agent_name', 'action', 'status', 'execution_time_ms', 'created_at')
        sort_direction: Sort direction ('asc' or 'desc')
    """
    print(
        f"\n[ENDPOINT HIT] GET /transactions/unreconciled - page={page}, page_size={page_size}, search='{search}', status='{status}', source='{source}', policy_no='{policy_no}', period='{period}', sort_key='{sort_key}', sort_direction='{sort_direction}'\n"
    )
    try:
       # Enforce maximum page size to prevent memory issues
        page_size = min(page_size, 500)
        page = max(page, 1)

        conditions = []

        conditions.append(UnreconciledTransaction.status == "unreconciled")
        conditions.append(UnreconciledTransaction.Reference.op("REGEXP")("PD00[0-9]{4}"))

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

        # Apply GROUP BY with aggregations
        # Add COUNT and SUM aggregations to the query
        query = query.add_columns(
            func.count(UnreconciledTransaction.id).label('row_count'),
            func.sum(UnreconciledTransaction.Amount).label('total_amount_group')
        ).group_by(UnreconciledTransaction.Reference)

        # Fetch paginated results
        results = query.offset(offset).limit(page_size).all()

        # Log the actual SQL query executed
        compiled_query = query.statement.compile(compile_kwargs={"literal_binds": True})
        print(f"\n[SQL Query Executed]\n{compiled_query}\n")

        # Convert to dictionary format
        # Results now include the aggregated data as additional tuple elements
        transactions_data = []
        for result in results:
            # result is a tuple of (UnreconciledTransaction, row_count, total_amount_group)
            txn = result[0]
            row_count = result[1]
            group_total = float(result[2] or 0)
            
            transactions_data.append({
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
                "row_count": row_count,
                "group_total_amount": group_total,
            })

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
