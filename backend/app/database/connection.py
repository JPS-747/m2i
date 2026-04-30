"""Database connection and session configuration."""
from __future__ import annotations

import logging
import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session

load_dotenv()

# Configure logging to show application logs but hide SQL logs
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
# Disable SQL query logging
sql_logger = logging.getLogger("sqlalchemy.engine")
sql_logger.setLevel(logging.WARNING)



# Support for multiple database types: sqlite, mysql, postgresql
DATABASE_TYPE = os.getenv("DATABASE_TYPE", "mysql").lower()
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_TYPE == "sqlite":
    # Use SQLite file or memory database
    SQLITE_PATH = os.getenv("SQLITE_PATH", "./sqlite.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    connect_args = {"check_same_thread": False}
    isolation_level = NoneS
elif DATABASE_TYPE in ("postgresql", "postgres"):
    if not DATABASE_URL:
        # Example: postgresql+psycopg2://user:password@localhost/dbname
        DB_USER = os.getenv("DB_USER", "postgres")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
        DB_HOST = os.getenv("DB_HOST", "localhost")
        DB_PORT = os.getenv("DB_PORT", "5432")
        DB_NAME = os.getenv("DB_NAME", "postgres")
        DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    connect_args = {}
    isolation_level = "READ_COMMITTED"
elif DATABASE_TYPE in ("mysql", "mariadb"):
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable must be set in .env file for MySQL/MariaDB databases.")
    connect_args = {"charset": "utf8mb4"}
    isolation_level = "READ_COMMITTED"
else:
    raise RuntimeError(f"Unsupported DATABASE_TYPE: {DATABASE_TYPE}")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
    isolation_level=isolation_level,
    echo=False,  # Disable SQL query logging
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
