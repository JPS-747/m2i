"""Authentication routes."""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    RegisterRequest,
    LoginRequest,
    AuthTokenResponse,
    LogoutResponse,
    UserResponse,
)
from app.services import (
    register_user,
    get_user_by_email,
    get_user_by_id,
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


async def get_current_user(
    authorization: str = Header(None), db: Session = Depends(get_db)
) -> User:
    """Dependency to get current user from JWT token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    """Register a new user."""
    try:
        logger.info(f"Registration attempt for email: {payload.email}")
        
        # Validate email format
        if "@" not in payload.email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Hash password
        password_hash = hash_password(payload.password)
        
        # Register user
        user = register_user(
            db,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
            company=payload.company,
            password_hash=password_hash
        )
        
        logger.info(f"User registered successfully: {user.id}")
        
        # Create access token
        access_token = create_access_token(data={"sub": user.id})
        
        return AuthTokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    except HTTPException as e:
        logger.error(f"Registration error: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during registration: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    """Login with email and password."""
    # Get user by email
    user = get_user_by_email(db, payload.email)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(current_user: User = Depends(get_current_user)) -> LogoutResponse:
    """Logout endpoint. Token validation is done via dependency."""
    return LogoutResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get current user information."""
    return UserResponse.model_validate(current_user)
