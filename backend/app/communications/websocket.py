"""WebSocket endpoints for real-time communications."""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .manager import get_connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["communications"])


@router.websocket("/ws/match-stats")
async def websocket_match_stats(websocket: WebSocket):
    """WebSocket endpoint for real-time match stats updates."""
    connection_manager = get_connection_manager()
    await connection_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        logger.info("Client disconnected from match-stats WebSocket")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        connection_manager.disconnect(websocket)
