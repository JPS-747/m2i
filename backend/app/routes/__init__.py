"""API routes package."""
from .health import router as health_router
from .auth import router as auth_router
from .periods import router as periods_router
from .files import router as files_router
from .matching import router as matching_router
from .settings import router as settings_router
from .transactions import router as transactions_router
from .agents import router as agents_router

__all__ = [
    "health_router",
    "auth_router",
    "periods_router",
    "files_router",
    "matching_router",
    "settings_router",
    "transactions_router",
    "agents_router",
]
