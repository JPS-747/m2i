from app.database.connection import SessionLocal
from app.services.periods import get_latest_period, _new_period_row
from app.models.financial_period import FinancialPeriod

def seed_data():
    db = SessionLocal()
    try:
        period = get_latest_period(db)
        if not period:
            # Default to current year and month as first period
            from datetime import datetime
            now = datetime.now()
            first_period = f"{now.year}{now.month:02d}"
            db.add(_new_period_row(first_period))
            db.commit()
            print(f"[SEED] Created initial period: {first_period}")
        else:
            print(f"[SEED] At least one period exists: {period.period}")
        # Add more default values here as needed
    finally:
        db.close()
