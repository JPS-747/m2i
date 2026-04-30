import csv
import re
from datetime import datetime
from io import StringIO
from typing import Tuple

import logging

from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, desc, event, func, select, update, case, and_
from sqlalchemy.orm import Session
from sqlalchemy.pool import Pool

from ..models import (
    ImportedFile,
    Transaction,
    FileMatching,
    MatchTypeSetting,
    UnreconciledTransaction,
    User,
)
from .periods import (
    _get_current_open_period_int,
    _get_current_working_period_int,
    _update_financial_period_totals,
)
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from app.services.settings import DBSettingsManager

logger = logging.getLogger("app.services")





def get_transactions_by_filter(
    db: Session,
    action_period: int,
    source: str | None = None,
    movement_types: list | None = None,
    multi_period: bool = True,
    reference_regex: str | None = None,
    credit_debit: str | None = None,
) -> list:
    conditions = []

    conditions.append(UnreconciledTransaction.status == "unreconciled")
    conditions.append(UnreconciledTransaction.PolicyNo != "0")

    if multi_period:
        conditions.append(UnreconciledTransaction.period <= action_period)

    if source:
        conditions.append(UnreconciledTransaction.Source == source)

    if movement_types:
        # movement_types is a list, use .in_() for multiple values
        if isinstance(movement_types, list):
            conditions.append(UnreconciledTransaction.MovementType.in_(movement_types))
        else:
            conditions.append(UnreconciledTransaction.MovementType == movement_types)

    if credit_debit == 'credit':
        conditions.append(UnreconciledTransaction.Amount > 0)
    elif credit_debit == 'debit':
        conditions.append(UnreconciledTransaction.Amount < 0)

    if reference_regex:
        conditions.append(UnreconciledTransaction.Reference.op("REGEXP")(reference_regex))

    query = select(
        UnreconciledTransaction.id,
        UnreconciledTransaction.Source,
        UnreconciledTransaction.PolicyNo,
        UnreconciledTransaction.Amount,
        UnreconciledTransaction.period,
    )

    if conditions:
        query = (
            query.where(and_(*conditions))
            if len(conditions) > 1
            else query.where(conditions[0])
        )
    
    # Print the compiled query for debugging
    print(f"\n{'='*100}")
    print(f"Compiled Query:\n{query.compile(compile_kwargs={'literal_binds': True})}")
    print(f"{'='*100}\n")
    
    results = db.execute(query).all()

    return results

def get_transactions_sum_by_filter(
    db: Session,
    action_period: int,
    source: str | None = None,
    movement_types: list | None = None,
    multi_period: bool = True,
    reference_regex: str | None = None,
    credit_debit: str | None = None,
) -> list:
    conditions = []

    conditions.append(UnreconciledTransaction.status == "unreconciled")

    if multi_period:
        conditions.append(UnreconciledTransaction.period <= action_period)

    if source:
        conditions.append(UnreconciledTransaction.Source == source)

    if movement_types:
        # movement_types is a list, use .in_() for multiple values
        if isinstance(movement_types, list):
            conditions.append(UnreconciledTransaction.MovementType.in_(movement_types))
        else:
            conditions.append(UnreconciledTransaction.MovementType == movement_types)

    if credit_debit == 'credit':
        conditions.append(UnreconciledTransaction.Amount > 0)
    if credit_debit == 'debit':
        conditions.append(UnreconciledTransaction.Amount < 0)

    if reference_regex:
        conditions.append(UnreconciledTransaction.Reference.op("REGEXP")(reference_regex))


    query = select(
        func.count(UnreconciledTransaction.id).label("id"),
        func.regexp_substr(
            UnreconciledTransaction.Reference,
            reference_regex
        ).label("PolicyNo") if reference_regex else UnreconciledTransaction.Reference.label("PolicyNo"),
        UnreconciledTransaction.period,
        func.sum(UnreconciledTransaction.Amount).label("Amount"),
    )
    
    if conditions:
        query = (
            query.where(and_(*conditions))
            if len(conditions) > 1
            else query.where(conditions[0])
        )

    query = query.group_by(
        UnreconciledTransaction.Source,
        UnreconciledTransaction.period,
        func.regexp_substr(
            UnreconciledTransaction.Reference,
            reference_regex
        ) if reference_regex else UnreconciledTransaction.Reference,
    )
   
    # Order by PolicyNo and period
    query = query.order_by(
        func.regexp_substr(
            UnreconciledTransaction.Reference,
            reference_regex
        ) if reference_regex else UnreconciledTransaction.Reference,
        UnreconciledTransaction.period,
    )

     # Print the compiled query for debugging
    print(f"\n{'='*100}")
    print(f"Compiled Query:\n{query.compile(compile_kwargs={'literal_binds': True})}")
    print(f"{'='*100}")
    

    results = db.execute(query).all()

    print(f"Query returned {len(results)} rows\n")

    return results

def match_one_to_many_impl(
    db: Session, match_type: dict
) -> dict[str, object]:
   
    start_time = datetime.now()
    # Get current working period
    current_period_int = _get_current_working_period_int(db)
    if current_period_int is None:
        raise HTTPException(
            status_code=409, detail="No open or active period available"
        )

    try:
        
        # Parse available parameters from settings
        key = match_type.get("key", "")
        if key == "":
            raise HTTPException(
                status_code=400, detail="Match type key is required in settings"
            )

        title = match_type.get("title")
        params = match_type.get("parameters", {})

        logger.info(f"  key: {key}")

        if params:
            logger.info(f"  Parameters: {params}")

        # For debit parameters
        debit_params = params.get("debit", {})
        debit_source = debit_params.get("source", [])
        debit_movement_types = debit_params.get("movement_types", [])
        debit_reference = debit_params.get("reference", None)
        debit_multi_period = debit_params.get("multi_period", False)
        debit_debit_credit = debit_params.get("debit_credit", "")


        # For credit parameters
        credit_params = params.get("credit", {})
        credit_source = credit_params.get("source", [])
        credit_movement_types = credit_params.get("movement_types", [])
        credit_reference = credit_params.get("reference", None)
        credit_multi_period = credit_params.get("multi_period", False)
        credit_debit_credit = credit_params.get("debit_credit", "credit")

        debit_results = get_transactions_sum_by_filter(db, current_period_int, debit_source, debit_movement_types, debit_multi_period, debit_reference, debit_debit_credit)
        credit_results = get_transactions_sum_by_filter(db, current_period_int, credit_source, credit_movement_types, credit_multi_period, credit_reference, credit_debit_credit)

        if len(debit_results) > 0 and len(credit_results) > 0:
            import pandas as pd
            # Convert results to DataFrames
            multiplier=1
            if debit_debit_credit == 'debit':
                multiplier = -1
            debit_df = pd.DataFrame([
                {
                    'PolicyNo': row.PolicyNo,
                    'Amount': row.Amount*multiplier,
                    'period': row.period,
                    'id': row.id,  # transaction count
                }
                for row in debit_results
            ])
            multiplier=1
            if credit_debit_credit == 'debit':
                multiplier = -1
            credit_df = pd.DataFrame([
                {
                    'PolicyNo': row.PolicyNo,
                    'Amount': row.Amount*multiplier,
                    'period': row.period,
                    'id': row.id,  # transaction count
                }
                for row in credit_results
            ])

            # Match by PolicyNo and Amount (with optional period alignment)

            # Match with Period alignment
            matched = pd.merge(
                debit_df,
                credit_df,
                on=['PolicyNo', 'Amount', 'period'],
                how='inner',
                suffixes=('_debit', '_credit')
            )
           
            # Get matched PolicyNo and periods
            matched_ids = matched['PolicyNo'].values.tolist()

            print(f"Matched {len(matched_ids)} records for MatchType '{key}'")
            print(f"Top 5 matched_ids: {matched_ids[:5]}")

            affected_count = 0
            if matched_ids:
                # Build the regex pattern for matching
                # credit_reference is a regex pattern like "PD00[0-9]{4}"
                # We need to find UnreconciledTransaction records where Reference matches this pattern
                # and the extracted policy number is in matched_ids
                
                if debit_reference:
                    # Use the credit_reference regex pattern to extract and match
                    result = db.execute(
                        update(UnreconciledTransaction)
                        .where(
                            func.regexp_substr(UnreconciledTransaction.Reference, debit_reference).in_(matched_ids),
                            UnreconciledTransaction.status == "unreconciled"
                        )
                        .values(status="matched", MatchType=key)
                    )
                else:
                    # Fallback: use the old substr/instr method if no regex pattern is provided
                    result = db.execute(
                        update(UnreconciledTransaction)
                        .where(
                            func.regexp_substr(UnreconciledTransaction.Reference, credit_reference).in_(matched_ids),
                            UnreconciledTransaction.status == "unreconciled"
                        )
                        .values(status="matched", MatchType=key)
                    )
                affected_count = result.rowcount or 0
                db.commit()

            
            elapsed_time = int((datetime.now() - start_time).total_seconds())
            
            _update_match_type_totals(
                db, key, affected_count, 0, elapsed_time
            )

            _update_financial_period_totals(db, current_period_int)
        else:
            affected_count = 0
            elapsed_time = int((datetime.now() - start_time).total_seconds())
            matched_ids = []


        return {
            "matched_count": affected_count,
            "matched_total_amount": 0,
            "period": current_period_int,
            "elapsed_time": elapsed_time,
            "message": f"Matched {len(matched_ids)}  Agencies",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during generic reversal matching: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error during generic reversal matching: {str(e)}"
        )

def match_one_to_one_impl(db: Session, match_type: dict) -> dict[str, object]:

    start_time = datetime.now()
    # Get current working period
    current_period_int = _get_current_working_period_int(db)
    if current_period_int is None:
        raise HTTPException(
            status_code=409, detail="No open or active period available"
        )

    try:
        
        # Parse available parameters from settings
        key= match_type.get("key", "")
        if key == "":
            raise HTTPException(
                status_code=400, detail="Match type key is required in settings"
            )
        params = match_type.get("parameters", {})
        title = match_type.get("title")
        description = match_type.get("description", "")

        logger.info(f"  Title: {title}")
        logger.info(f"  Description: {description}")

        if params:
            logger.info(f"  Parameters: {params}")

        # For debit parameters
        debit_params = params.get("debit", {})
        debit_source = debit_params.get("source", None)
        debit_movement_types = debit_params.get("movement_types", [])
        debit_reference = debit_params.get("reference", None)
        debit_multi_period = debit_params.get("multi_period", False)
        debit_debit_credit = debit_params.get("debit_credit", "credit")

        # For credit parameters
        credit_params = params.get("credit", {})
        credit_source = credit_params.get("source", None)
        credit_movement_types = credit_params.get("movement_types", [])
        credit_reference = credit_params.get("reference", None)
        credit_multi_period = credit_params.get("multi_period", False)
        credit_debit_credit = credit_params.get("debit_credit", "credit")

        debit_results = get_transactions_by_filter(db, current_period_int, debit_source, debit_movement_types, debit_multi_period, debit_reference, debit_debit_credit)
        credit_results = get_transactions_by_filter(db, current_period_int, credit_source, credit_movement_types, credit_multi_period, credit_reference, credit_debit_credit)

        if len(debit_results) > 0 and len(credit_results) > 0:
            import pandas as pd

            # Convert results to DataFrames
            multiplier=1
            if debit_debit_credit == 'debit':
                multiplier = -1
            debit_df = pd.DataFrame([
                {
                    'PolicyNo': row.PolicyNo,
                    'Amount': row.Amount*multiplier,
                    'period': row.period,
                    'id': row.id,  # transaction count
                }
                for row in debit_results
            ])
            # Rename id column to id_debit before merge
            debit_df = debit_df.rename(columns={'id': 'id_debit'})
            
            multiplier=1
            if credit_debit_credit == 'debit':
                multiplier = -1
            credit_df = pd.DataFrame([
                {
                    'PolicyNo': row.PolicyNo,
                    'Amount': row.Amount*multiplier,
                    'period': row.period,
                    'id': row.id,  # transaction count
                }
                for row in credit_results
            ])
            # Rename id column to id_credit before merge
            credit_df = credit_df.rename(columns={'id': 'id_credit'})

            # Match by PolicyNo and Amount (with optional period alignment)
            if debit_multi_period or credit_multi_period:
                # If either is multi-period, ignore period in matching but preserve both period columns
                matched = pd.merge(
                    debit_df,
                    credit_df,
                    on=['PolicyNo', 'Amount'],
                    how='inner',
                    suffixes=('_debit', '_credit')
                )
            else:
                # Include period in matching
                matched = pd.merge(
                    debit_df,
                    credit_df,
                    on=['PolicyNo', 'Amount', 'period'],
                    how='inner'
                )
                
            if not debit_multi_period and not credit_multi_period:
                matched = matched.sort_values(['PolicyNo', 'period'], ascending=[True, False])
            else:  
                if debit_multi_period:
                    matched = matched.sort_values(['PolicyNo', 'period_debit', 'period_credit'], ascending=[True, False, False])
                if credit_multi_period:
                    matched = matched.sort_values(['PolicyNo', 'period_credit','period_debit'], ascending=[True, False, False])

            
            print(f"\nDebit DataFrame after sorting (count: {len(matched)}):")
            print(debit_df)
            print(f"\nCredit DataFrame after sorting (count: {len(matched)}):")
            print(credit_df)
            

            # Drop rows where id_debit equals id_credit
            print(f"\nFinal matched records before dropping self-matches: {len(matched)}")
            matched = matched[matched['id_debit'] != matched['id_credit']]
            print(f"\nFinal matched records after dropping self-matches: {len(matched)}")
            
           
            
            # Display rows with specific PolicyNo
            policy_filter = matched[matched['PolicyNo'] == '41935693']
            if len(policy_filter) > 0:
                print(f"\nRows with PolicyNo 41935693 (count: {len(policy_filter)}):")
                print(policy_filter)
            else:
                print(f"\nNo rows found with PolicyNo 41935693")

            # Capture unmatched rows before deduplication
            all_matched = matched.copy()

            # Deduplicate iteratively until stable
            iteration = 0
            while True:
                iteration += 1
                initial_count = len(matched)
                
                
                # Deduplicate by id_debit and id_credit
                matched = matched.drop_duplicates(subset=['id_debit'], keep='first')
                matched = matched.drop_duplicates(subset=['id_credit'], keep='first')
                
                # Get removed rows
                removed = all_matched[~all_matched.index.isin(matched.index)]
                
                # Find removed rows where NEITHER id_debit nor id_credit appear in current matched
                can_readd = removed[
                    (~removed['id_debit'].isin(matched['id_debit'])) &
                    (~removed['id_credit'].isin(matched['id_credit']))
                ]
                
                if len(can_readd) == 0:
                    print(f"\nIteration {iteration}: No more rows to add back. Stopping.")
                    break
                
                print(f"\nIteration {iteration}: Found {len(can_readd)} rows with no matching IDs. Adding back...")
                matched = pd.concat([matched, can_readd], ignore_index=False)
                
                if len(matched) == initial_count:
                    print(f"Iteration {iteration}: No change in matched count. Stopping.")
                    break
            
            
            
            print(f"\nFinal matched records: {len(matched)}")
            print(f"\nTop 5 matched records (after iterative deduplication):")
            print(matched.head())

            
           
            # Get matched PolicyNo and periods
            matched_ids = matched['id_debit'].values.tolist()
            matched_ids.extend(matched['id_credit'].values.tolist())            
            print(f"Top 5 matched IDs: {matched_ids[:5]}")

            affected_count = 0
            if matched_ids:
                result = db.execute(
                    update(UnreconciledTransaction)
                    .where(UnreconciledTransaction.id.in_(matched_ids))
                    .values(status="matched", MatchType=key)
                )
                affected_count = result.rowcount or 0
                db.commit()

            
            elapsed_time = int((datetime.now() - start_time).total_seconds())
            
            _update_match_type_totals(
                db, key, affected_count, 0, elapsed_time
            )

            _update_financial_period_totals(db, current_period_int)
        else:
            affected_count = 0
            elapsed_time = int((datetime.now() - start_time).total_seconds())
            matched_ids = []


        return {
            "matched_count": affected_count,
            "matched_total_amount": 0,
            "period": current_period_int,
            "elapsed_time": elapsed_time,
            "message": f"Matched {len(matched_ids)}  Agencies",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during generic reversal matching: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error during generic reversal matching: {str(e)}"
        )

# File operations have been moved to services.files module
from .files import (
    get_transaction_file_summaries,
    import_transactions_csv,
    delete_transactions_file,
    preview_csv_file,
    import_transactions_csv_with_mapping,
)

def _log_sample_data(
    db: Session, matched_ids: list, match_type: str, max_samples: int = 5
) -> None:
    """
    Log sample data (max 5 rows) from matched transactions for overview report.

    Args:
        db: Database session
        matched_ids: List of transaction IDs that were matched
        match_type: Name of the match type (e.g., 'agencies', 'policy')
        max_samples: Maximum number of sample rows to log (default 5)
    """
    if not matched_ids or len(matched_ids) == 0:
        logger.info(f"  Sample data: No transactions matched")
        return

    try:
        # Fetch sample rows
        sample_limit = min(max_samples, len(matched_ids))
        sample_ids = matched_ids[:sample_limit]

        samples = db.execute(
            select(
                UnreconciledTransaction.id,
                UnreconciledTransaction.RecordId,
                UnreconciledTransaction.Amount,
                UnreconciledTransaction.Source,
                UnreconciledTransaction.PolicyNo,
                UnreconciledTransaction.status,
                UnreconciledTransaction.MatchType,
            ).where(UnreconciledTransaction.id.in_(sample_ids))
        ).fetchall()

        logger.info(
            f"  Sample data (showing {len(samples)} of {len(matched_ids)} matched transactions):"
        )
        for idx, row in enumerate(samples, 1):
            logger.info(
                f"    [{idx}] ID: {row[0][:8]}... | RecordID: {row[1]} | "
                f"Amount: {row[2]} | Source: {row[3]} | PolicyNo: {row[4]} | "
                f"Status: {row[5]} | MatchType: {row[6]}"
            )
    except Exception as e:
        logger.warning(f"  Could not log sample data: {str(e)}")


def get_match_type_totals(db: Session) -> dict[str, object]:
    """
    Calculate match type totals (count and amount) for all active match types.
    Also returns global unmatched totals and elapsed time for each match type.

    Returns:
    - Dictionary with:
      - "match_types": Dictionary mapping match_type_key to {
          count: int (matched count for this type),
          total: float (matched amount for this type),
          elapsed_time: int (elapsed time for this match type in seconds)
        }
      - "overall": {
          total_matched_count: int (sum of all matched counts),
          total_matched_amount: float (sum of all matched amounts)
        }
      - "unmatched": {
          count: int (total unmatched count),
          total: float (total unmatched amount)
        }
    """
    try:
        # Get current working period
        current_period_int = _get_current_working_period_int(db)
        if current_period_int is None:
            return {
                "match_types": {},
                "overall": {
                    "total_matched_count": 0,
                    "total_matched_amount": 0.0,
                    "total_unmatched_count": 0,
                    "total_unmatched_amount": 0.0,
                },
                "unmatched": {"count": 0, "total": 0.0},
            }

        # Get all active match types from settings table
        match_types = db.query(MatchTypeSetting).all()

        result = {
            "match_types": {},
            "overall": {
                "total_matched_count": 0,
                "total_matched_amount": 0.0,
                "total_unmatched_count": 0,
                "total_unmatched_amount": 0.0,
            },
        }

        total_matched_count = 0
        total_matched_amount = 0.0

        for match_type in match_types:
            # Get matched totals from MatchTypeSetting table
            matched_count = match_type.total_count or 0
            matched_total = float(match_type.total_amount or 0)
            elapsed_time = match_type.elapsed_time or 0

            result["match_types"][match_type.key] = {
                "count": matched_count,
                "total": matched_total,
                "elapsed_time": elapsed_time,
            }

            total_matched_count += matched_count
            total_matched_amount += matched_total

        # Get global unmatched totals from UnreconciledTransaction with source adjustment
        unmatched_count = db.scalar(
            select(func.count(UnreconciledTransaction.id)).where(
                UnreconciledTransaction.action_period == current_period_int,
                UnreconciledTransaction.status == "unreconciled",
            )
        )

        # Sum amounts for unreconciled transactions with source adjustment
        unmatched_total = db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                UnreconciledTransaction.Source == "System",
                                UnreconciledTransaction.Amount * -1,
                            ),
                            else_=UnreconciledTransaction.Amount,
                        )
                    ),
                    0,
                )
            ).where(
                UnreconciledTransaction.action_period == current_period_int,
                UnreconciledTransaction.status == "unreconciled",
            )
        )

        count_unmatched = int(unmatched_count or 0)
        total_unmatched = float(unmatched_total or 0)

        # Set overall totals
        result["overall"]["total_matched_count"] = total_matched_count
        result["overall"]["total_matched_amount"] = total_matched_amount
        result["overall"]["total_unmatched_count"] = count_unmatched
        result["overall"]["total_unmatched_amount"] = total_unmatched

        return result
    except Exception as e:
        logger.error(f"Error calculating match type totals: {str(e)}", exc_info=True)
        return {
            "match_types": {},
            "overall": {"total_matched_count": 0, "total_matched_amount": 0.0},
            "unmatched": {"count": 0, "total": 0.0},
        }

def _update_match_type_totals(
    db: Session,
    match_type_key: str,
    matched_count: int,
    matched_total: float,
    elapsed_time: int = 0,
) -> None:
    """Update the total_count, total_amount, elapsed_time, and status for a match type by adding to existing values.

    Status is set based on whether there's a balance mismatch:
    - "success": matched_total is 0 (perfect balance)
    - "error": matched_total is not 0 (balance mismatch)
    - "pending": no matches (matched_count is 0)
    """
    try:
        from decimal import Decimal

        logger.info(
            f"_update_match_type_totals called: key={match_type_key}, count={matched_count}, total={matched_total}, elapsed={elapsed_time}"
        )

        match_type = db.scalar(
            select(MatchTypeSetting).where(MatchTypeSetting.key == match_type_key)
        )
        if not match_type:
            logger.warning(f"MatchTypeSetting '{match_type_key}' not found")
            return

        # Convert matched_total to Decimal if needed to match the column type
        matched_total_decimal = Decimal(str(matched_total))

        # Accumulate counts and totals
        old_count = match_type.total_count or 0
        old_amount = match_type.total_amount or Decimal("0")

        match_type.total_count = (match_type.total_count or 0) + matched_count
        match_type.total_amount = (
            match_type.total_amount or Decimal("0")
        ) + matched_total_decimal
        match_type.elapsed_time = (match_type.elapsed_time or 0) + elapsed_time

        # Set status based on balance
        if matched_count == 0:
            match_type.status = "pending"
        elif (
            abs(float(match_type.total_amount)) < 0.01
        ):  # Account for floating point precision
            match_type.status = "success"
        else:
            match_type.status = "error"

        db.add(match_type)
        db.commit()
        logger.info(
            f"Updated MatchTypeSetting '{match_type_key}': OLD count={old_count}, amount={old_amount} -> NEW count={match_type.total_count}, amount={match_type.total_amount}, elapsed_time={match_type.elapsed_time}s, status={match_type.status}"
        )
    except Exception as e:
        logger.error(f"Error updating match type totals: {str(e)}", exc_info=True)

def reset_match_type(db: Session, match_type_key: str) -> dict[str, object]:
    """
    Reset a specific match type by:
    1. Finding UnreconciledTransaction records with that MatchType
    2. Updating them back to status='unreconciled' and MatchType='' (empty)
    3. Resetting the MatchType totals to 0 count and 0 amount
    4. Recalculating FinancialPeriod totals from remaining MatchType records
    """
    try:
        from decimal import Decimal

        start_time = datetime.now()

        current_period_int = _get_current_working_period_int(db)
        if current_period_int is None:
            raise HTTPException(
                status_code=409, detail="No open or active period available"
            )

        # Get the match type object
        match_type_obj = db.scalar(
            select(MatchTypeSetting).where(MatchTypeSetting.key == match_type_key)
        )
        if not match_type_obj:
            raise HTTPException(
                status_code=404, detail=f"Match type '{match_type_key}' not found"
            )

        result = db.execute(
            update(UnreconciledTransaction)
            .where(
                UnreconciledTransaction.action_period == current_period_int,
                UnreconciledTransaction.MatchType == match_type_key,
            )
            .values(status="unreconciled", MatchType="")
        )
        db.commit()
        matched_txn_count = result.rowcount or 0

        match_type_obj.total_count = 0
        match_type_obj.total_amount = Decimal("0")
        match_type_obj.elapsed_time = 0
        match_type_obj.status = "pending"
        db.add(match_type_obj)
        db.commit()

        _update_financial_period_totals(db, current_period_int)
        elapsed_time = int((datetime.now() - start_time).total_seconds())

        return {
            "success": True,
            "message": f"Reset matching records",
            "reset_count": matched_txn_count,
            "period": current_period_int,
            "elapsed_time": elapsed_time,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            f"Error resetting match type '{match_type_key}': {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Error resetting match type: {str(e)}"
        )

def reset_all_transactions(db: Session) -> dict[str, object]:
    """
    Global reset: Reset ALL transactions to 'unreconciled' status and clear all MatchTypes,
    regardless of their current status or MatchType assignment.

    This operation:
    1. Updates all UnreconciledTransaction records to status='unreconciled' and MatchType=''
    2. Resets ALL MatchType totals to 0 count and 0 amount
    3. Recalculates FinancialPeriod totals from remaining MatchType records

    Returns:
    - Reset results with total count of reset transactions and reset status
    """
    try:
        from decimal import Decimal

        start_time = datetime.now()

        current_period_int = _get_current_working_period_int(db)
        if current_period_int is None:
            raise HTTPException(
                status_code=409, detail="No open or active period available"
            )

        result = db.execute(
            update(UnreconciledTransaction)
            .where(UnreconciledTransaction.action_period == current_period_int)
            .values(status="unreconciled", MatchType="")
        )
        db.commit()
        total_reset_count = result.rowcount or 0

        all_match_types = db.query(MatchTypeSetting).all()
        for match_type_obj in all_match_types:
            match_type_obj.total_count = 0
            match_type_obj.total_amount = Decimal("0")
            match_type_obj.elapsed_time = 0
            match_type_obj.status = "pending"
            db.add(match_type_obj)
            logger.info(
                f"  Reset MatchTypeSetting '{match_type_obj.key}': total_count=0, total_amount=0, elapsed_time=0, status=pending"
            )
        db.commit()
       
        _update_financial_period_totals(db, current_period_int)
        logger.info("  Successfully updated FinancialPeriod totals")

        elapsed_time = int((datetime.now() - start_time).total_seconds())
        
        return {
            "success": True,
            "message": "Global reset completed - all transactions returned to unreconciled",
            "reset_count": total_reset_count,
            "match_types_reset": len(all_match_types),
            "period": current_period_int,
            "elapsed_time": elapsed_time,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during global reset: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error during global reset: {str(e)}"
        )

def update_match_type_order(
    db: Session, match_type_keys: list[str]
) -> dict[str, object]:
    """
    Update the display order of match types based on the provided list.

    Parameters:
    - db: Database session
    - match_type_keys: List of match type keys in desired order (0-indexed)
    """
    try:
        logger.info("=" * 80)
        logger.info("UPDATING MATCH TYPE ORDER")
        logger.info(f"New order: {match_type_keys}")

        settings_manager = DBSettingsManager(db)

        # Update display_order for each match type based on its position in the list
        for index, key in enumerate(match_type_keys):
            settings_data = {"display_order": index}
            settings_manager.update_match_type_settings(key, settings_data)
            logger.info(f"  Set {key} display_order to {index}")

        logger.info("Match type order updated successfully")

        return {
            "message": "Match type order updated successfully",
            "updated_count": len(match_type_keys),
        }
    except Exception as e:
        logger.error(f"Error updating match type order: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error updating match type order: {str(e)}"
        )

def match_from_file_impl(
    db: Session, key: str, match_type: dict, data: dict
) -> dict[str, object]:
    """Match transaction IDs from file by finding them in UnreconciledTransaction, updating status to matched and MatchType.

    Parameters:
    - db: Database session
    - key: Match type key from settings (e.g., "fromFile")
    - match_type: Full match type configuration from settings.json (dict with title, description, parameters, etc.)
    - data: Data payload containing transaction IDs ({"ids": [...], "idColumn": ""})
    """
    try:
        start_time = datetime.now()
        
        ids = data.get("ids", [])
        id_column = data.get("idColumn", "")

        # Parse available parameters from settings
        params = match_type.get("parameters", {})
        title = match_type.get("title", key)
        description = match_type.get("description", "")
        state_key = match_type.get("state_key", key)
        logger.info(f"  Title: {title}")
        logger.info(f"  Description: {description}")
        logger.info(f"  State Key: {state_key}")
        if params:
            logger.info(f"  Parameters: {params}")

        if not ids or not isinstance(ids, list):
            raise HTTPException(status_code=400, detail="No IDs provided")

        # Get current working period
        current_period_int = _get_current_working_period_int(db)
        if current_period_int is None:
            raise HTTPException(
                status_code=409, detail="No open or active period available"
            )

        # GUID pattern: 8-4-4-4-12 hex characters
        guid_pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )

        # STEP 1: Validate and collect valid IDs
        logger.info("STEP 1: Validating transaction IDs...")
        matched_count = 0
        skipped_count = 0
        valid_ids = []

        for transaction_id in ids:
            if not transaction_id or not str(transaction_id).strip():
                skipped_count += 1
                continue

            id_str = str(transaction_id).strip()
            
            # Remove surrounding quotes (single or double)
            if (id_str.startswith('"') and id_str.endswith('"')) or (id_str.startswith("'") and id_str.endswith("'")):
                id_str = id_str[1:-1]

            # Skip empty strings after quote removal
            if not id_str:
                skipped_count += 1
                continue

            # Skip non-GUID values
            if not guid_pattern.match(id_str):
                skipped_count += 1
                logger.debug(f"Skipped non-GUID ID: {id_str}")
                continue

            id_str = id_str[:150]
            valid_ids.append(id_str)
            matched_count += 1

        logger.info(f"  Valid IDs: {matched_count}, Skipped: {skipped_count}")

        # STEP 2: Update UnreconciledTransaction status and MatchType
        logger.info("STEP 2: Updating UnreconciledTransaction records...")
        if valid_ids:
            db.execute(
                update(UnreconciledTransaction)
                .where(UnreconciledTransaction.id.in_(valid_ids))
                .values(status="matched", MatchType=key)
            )
            db.commit()
            logger.info(
                f"  Updated {len(valid_ids)} transactions to matched with MatchType='{key}'"
            )

            # STEP 3: Calculate total amount with source adjustment
            logger.info("STEP 3: Calculating matched total amount...")
            amount_result = db.scalar(
                select(
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    UnreconciledTransaction.Source == "System",
                                    UnreconciledTransaction.Amount * -1,
                                ),
                                else_=UnreconciledTransaction.Amount,
                            )
                        ),
                        0,
                    )
                ).where(
                    UnreconciledTransaction.id.in_(valid_ids),
                    UnreconciledTransaction.MatchType == key,
                )
            )
            matched_total_amount = float(amount_result or 0)
            logger.info(f"  Total matched amount: {matched_total_amount}")
        else:
            matched_count = 0
            matched_total_amount = 0.0
            logger.info("  No valid IDs to process")

        # STEP 4: Calculate elapsed time
        elapsed_time = int((datetime.now() - start_time).total_seconds())
        logger.info(f"STEP 4: Elapsed time: {elapsed_time}s")

        # STEP 4.5: Log sample data for report
        logger.info("STEP 4.5: Sample matched transactions (for overview report):")
        _log_sample_data(db, valid_ids, key)

        # STEP 5: Update MatchType totals
        logger.info(f"STEP 5: Updating MatchType '{key}' totals...")
        _update_match_type_totals(
            db, key, matched_count, matched_total_amount, elapsed_time
        )
        logger.info(f"  MatchType updated successfully")

        # STEP 6: Update FinancialPeriod from sum of all MatchType records
        logger.info(
            "STEP 6: Updating FinancialPeriod from sum of all MatchType records..."
        )
        _update_financial_period_totals(db, current_period_int)
        logger.info(f"  FinancialPeriod updated successfully")

        logger.info("=" * 80)
        logger.info(
            f"FILE MATCHING COMPLETED SUCCESSFULLY in {elapsed_time}s (key: {key})"
        )
        logger.info(
            f"  Total matched: {matched_count} transactions, {matched_total_amount}"
        )
        logger.info("=" * 80)

        return {
            "matched_count": matched_count,
            "matched_total_amount": matched_total_amount,
            "skipped_count": skipped_count,
            "period": current_period_int,
            "elapsed_time": elapsed_time,
            "idColumn": id_column,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("=" * 80)
        logger.error(
            f"ERROR DURING FILE MATCHING (key: {key}): {str(e)}", exc_info=True
        )
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=f"Error during matching: {str(e)}")

def match_from_file(db: Session, key: str, data: dict = None) -> dict[str, object]:
    """
    File-based matching endpoint that handles transaction IDs from file.
    Reads match configuration from settings.json.

    Parameters:
    - db: Database session
    - key: Match type key (e.g., "fromFile", "fromCustomerFile")
    - data: Required data payload containing transaction IDs ({"ids": [...]})

    Returns:
    - Matching results with count, total amount, and status
    """
    try:
        settings_manager = DBSettingsManager(db)
        match_type = settings_manager.get_match_type(key)

        if not match_type:
            raise HTTPException(
                status_code=404, detail=f"Match type '{key}' not found in settings"
            )

        if not data:
            raise HTTPException(
                status_code=400, detail="File matching requires data payload with 'ids'"
            )

        # Call the core file matching function with key and match_type settings
        return match_from_file_impl(db, key, match_type, data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in match_from_file for '{key}': {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error in file matching: {str(e)}")

def match_one_to_many(db: Session, key: str) -> dict[str, object]:
    """
    OneToMany matching endpoint for pattern-based matching (agencies, government, etc.).
    Reads match pattern from settings.json and executes the match_one_to_many_impl function.

    Parameters:
    - db: Database session
    - key: Match type key (e.g., "agencies", "GRN")

    Returns:
    - Matching results with count, total amount, and status
    """
    try:
        settings_manager = DBSettingsManager(db)
        match_type = settings_manager.get_match_type(key)

        if not match_type:
            raise HTTPException(
                status_code=404, detail=f"Match type '{key}' not found in settings"
            )

        # Pass match_type key and full match_type config to impl for logging and MatchType tracking
        return match_one_to_many_impl(db, match_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in match_one_to_many for '{key}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error in one-to-many matching: {str(e)}"
        )

def match_one_to_one(db: Session, key: str) -> dict[str, object]:
    """
    OneToOne matching endpoint that reads parameters from settings.json.

    Parameters:
    - db: Database session
    - key: Match type key (e.g., "individual", "cashReversals", "bankReversals", etc.)

    Returns:
    - Matching results with count, total amount, and status
    """
    try:
        settings_manager = DBSettingsManager(db)
        match_type = settings_manager.get_match_type(key)

        if not match_type:
            raise HTTPException(
                status_code=404, detail=f"Match type '{key}' not found in settings"
            )

        # Pass match_type key and full match_type config to impl for logging and MatchType tracking
        return match_one_to_one_impl(db,  match_type)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in match_one_to_one for '{key}': {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error matching by key: {str(e)}")


# ======================== Authentication Services ========================
# User management functions have been moved to services.users module
from .users import (
    register_user,
    authenticate_user,
    get_user_by_email,
    get_user_by_id,
)

