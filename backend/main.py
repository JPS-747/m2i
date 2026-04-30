from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.communications import websocket_router
from app.routes import (
    health_router,
    auth_router,
    periods_router,
    files_router,
    matching_router,
    settings_router,
    transactions_router,
    agents_router,
)



logging.basicConfig(filename='app.log', level=logging.DEBUG)

logger = logging.getLogger(__name__)



from app.services.seedData import seed_data

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan context manager."""
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


app = FastAPI(title="Financial Period API", version="1.0.0", lifespan=lifespan)


cors_allow_origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
)
allow_origins = [
    origin.strip() for origin in cors_allow_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    """Log all incoming requests."""
    print(f"\n[REQUEST] {request.method} {request.url.path}")
    response = await call_next(request)
    return response


# Include all routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(periods_router)
app.include_router(files_router)
app.include_router(matching_router)
app.include_router(settings_router)
app.include_router(transactions_router)
app.include_router(agents_router)
app.include_router(websocket_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,          # module:variable
        host="0.0.0.0",      # listen on all interfaces
        port=8000,           # choose your port
        reload=False         # disable reload in production
    )
