"""Common utilities for services."""
import logging

logger = logging.getLogger("app.services")
logger.setLevel(logging.INFO)


def build_regex_condition(regex_pattern: str):
    """
    Convert regex pattern to SQL expression. Returns a condition that works across databases.

    Args:
        regex_pattern: Pattern string (e.g., "PD00[0-9]{4}" or "REVERSAL")

    Returns:
        SQLAlchemy condition or None
    """
    if not regex_pattern or not regex_pattern.strip():
        return None

    regex_pattern = regex_pattern.strip()

    # Add anchors for full-string match
    if not regex_pattern.startswith("^"):
        regex_pattern = "^" + regex_pattern
    if not regex_pattern.endswith("$"):
        regex_pattern = regex_pattern + "$"

    # Fallback: LIKE pattern for [0-9]{N} style patterns
    import re as regex_module

    if regex_module.match(r"^\^?[A-Z0-9]*\[0-9\]\{[0-9]+\}\$?$", regex_pattern):
        match = regex_module.match(
            r"^\^?([A-Z0-9]*)\[0-9\]\{(\d+)\}\$?$", regex_pattern
        )
        if match:
            prefix = match.group(1)
            count = int(match.group(2))
            like_pattern = prefix + ("_" * count)
            logger.info(f"Converted regex '{regex_pattern}' to LIKE '{like_pattern}'")
            return like_pattern

    # Ultimate fallback: wildcard LIKE
    logger.warning(f"Regex '{regex_pattern}' - using LIKE fallback")
    return "%" + regex_pattern.strip("^$") + "%"


def add_custom_value(value: str | int):
    """
    Add a custom literal value to a SQLAlchemy query.
    
    Args:
        value: The custom value to add (string or integer)
    
    Returns:
        SQLAlchemy literal expression
    """
    from sqlalchemy import literal
    return literal(value)
