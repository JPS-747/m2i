from app.database.connection import SessionLocal
from app.services.periods import get_latest_period, _new_period_row
from app.models.financial_period import FinancialPeriod

from app.models.user import User
from app.models.match_type_setting import MatchTypeSetting
from app.auth.security import hash_password

params_json = {
    "debit": {
        "source": [],
        "movement_types": [],
        "reference": None,
        "multi_period": False,
        "debit_credit": "credit"
    },
    "credit": {
        "source": [],
        "movement_types": [],
        "reference": None,
        "multi_period": False,
        "debit_credit": "credit"
    }
}


def seed_data():
    db = SessionLocal()
    try:
        # Ensure at least one period
        period = get_latest_period(db)
        if not period:
            from datetime import datetime
            now = datetime.now()
            first_period = f"{now.year}{now.month:02d}"
            db.add(_new_period_row(first_period))
            db.commit()
            print(f"[SEED] Created initial period: {first_period}")
        else:
            print(f"[SEED] At least one period exists: {period.period}")

        # Ensure at least one user (admin)
        user_count = db.query(User).count()
        if user_count == 0:
            admin_user = User(
                email="admin@localhost",
                first_name="Admin",
                last_name="User",
                company=None,
                password_hash=hash_password("admin"),
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            print("[SEED] Created default admin user: admin@localhost / admin")
        else:
            print("[SEED] At least one user exists.")

        # Ensure at least one MatchTypeSetting
        match_type_count = db.query(MatchTypeSetting).count()
        if match_type_count == 0:
            default_match_type = MatchTypeSetting(
                key="default",
                title="Default Match Type",
                description="Auto-created default match type setting.",
                type="basic",
                display_order=0,
                is_active=True,
                parameters=str(params_json),  # Store as JSON string
                total_count=0,
                total_amount=0.00,
                elapsed_time=0,
                status="pending",
            )
            db.add(default_match_type)
            db.commit()
            print("[SEED] Created default MatchTypeSetting.")
        else:
            print("[SEED] At least one MatchTypeSetting exists.")
    finally:
        db.close()
