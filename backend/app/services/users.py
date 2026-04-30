"""User management services."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import User


def register_user(
    db: Session,
    email: str,
    first_name: str,
    last_name: str,
    company: str | None,
    password_hash: str,
) -> User:
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    new_user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        company=company,
        password_hash=password_hash,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def authenticate_user(db: Session, email: str, password_hash: str) -> User | None:
    """Authenticate a user by email and password."""
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        return None

    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    """Get a user by email."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Get a user by ID."""
    return db.query(User).filter(User.id == user_id).first()
