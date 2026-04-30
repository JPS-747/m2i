# Fix passlib compatibility with bcrypt 4.0+
import sys
import bcrypt as _bcrypt_module

if not hasattr(_bcrypt_module, "__about__"):
    _bcrypt_module.__about__ = type(sys)("__about__")
    _bcrypt_module.__about__.__version__ = _bcrypt_module.__version__

# Ensure bcrypt is properly initialized
import os
import sys
from pathlib import Path

os.environ["PASSLIB_BUILTIN_BCRYPT"] = "1"

from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt

# Add parent directory to path to import config from root

# Use environment variables for JWT settings
JWT_SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
try:
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1))
except ValueError:
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 1

# Password hashing with explicit bcrypt configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__default_ident="2b",
)


def hash_password(password: str) -> str:
    """Hash a plain password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token for local auth"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.JWTError:
        return None
