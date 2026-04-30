"""
Services package - organized business logic for the application.

This package contains all service functions for:
- Authentication and user management
- Transaction processing and CSV imports
- Financial period management
- Transaction matching and reconciliation
- Utility functions
"""

# Import from submodules
from .common import (
    build_regex_condition,
    add_custom_value,
)

from .users import (
    register_user,
    authenticate_user,
    get_user_by_email,
    get_user_by_id,
)

from .periods import (
    _next_period,
    _new_period_row,
    _get_current_open_period_int,
    _get_current_working_period_int,
    _update_financial_period_totals,
    close_period,
    activate_period,
    open_period,
    get_latest_period,
    get_latest_periods,
)

from .reporting import (
    get_match_type_totals,
)

from .files import (
    # Transaction & file operations
    get_transaction_file_summaries,
    import_transactions_csv,
    import_transactions_csv_with_mapping,
    delete_transactions_file,
    preview_csv_file,
)

from .matching import (
    # Filtering utilities
    get_transactions_by_filter,
    get_transactions_sum_by_filter,
    # Matching functions
    match_from_file,
    match_from_file_impl,
    match_one_to_many,
    match_one_to_one,
    match_one_to_many_impl,
    match_one_to_one_impl,
    reset_match_type,
    reset_all_transactions,
    update_match_type_order,
    # Internal helpers (prefixed with _)
    _update_match_type_totals,
    _log_sample_data,
)

__all__ = [
    # User management
    "register_user",
    "authenticate_user",
    "get_user_by_email",
    "get_user_by_id",
    # Utilities
    "build_regex_condition",
    "add_custom_value",
    # Filtering & transactions
    "get_transactions_by_filter",
    "get_transactions_sum_by_filter",
    # Matching
    "match_from_file",
    "match_from_file_impl",
    "match_one_to_many",
    "match_one_to_one",
    "match_one_to_many_impl",
    "match_one_to_one_impl",
    "reset_match_type",
    "reset_all_transactions",
    "update_match_type_order",
    # Periods
    "close_period",
    "activate_period",
    "open_period",
    "get_latest_period",
    "get_latest_periods",
    # Files & imports
    "get_transaction_file_summaries",
    "import_transactions_csv",
    "import_transactions_csv_with_mapping",
    "delete_transactions_file",
    "preview_csv_file",
    # Reporting
    "get_reconciled_totals",
    "get_match_type_totals",
    # Internal helpers
    "_next_period",
    "_new_period_row",
    "_get_current_open_period_int",
    "_get_current_working_period_int",
    "_update_financial_period_totals",
    "_update_match_type_totals",
    "_log_sample_data",
]
