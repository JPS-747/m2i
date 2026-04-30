"""WebSocket manager for real-time stats updates"""

import json
import logging
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for broadcasting stats updates"""

    def __init__(self):
        """Initialize the connection manager"""
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(
            f"WebSocket connected. Active connections: {len(self.active_connections)}"
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a disconnected WebSocket"""
        self.active_connections.discard(websocket)
        logger.info(
            f"WebSocket disconnected. Active connections: {len(self.active_connections)}"
        )

    async def broadcast_stats_update(self, match_type_key: str, stats: dict):
        """
        Broadcast a stats update to all connected clients

        Args:
            match_type_key: The key of the match type that was updated
            stats: Dictionary containing the updated stats (matched_count, matched_total_amount, etc.)
        """
        message = {
            "type": "stats_update",
            "match_type_key": match_type_key,
            "stats": stats,
        }

        logger.info(f"Broadcasting stats update for '{match_type_key}': {stats}")
        logger.info(f"Active connections: {len(self.active_connections)}")

        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                logger.debug(f"Sent stats update to client for '{match_type_key}'")
            except Exception as e:
                logger.warning(f"Failed to send message to client: {e}")
                disconnected_clients.append(connection)

        # Clean up disconnected clients
        for connection in disconnected_clients:
            self.disconnect(connection)

    async def broadcast_match_complete(self, match_type_key: str, elapsed_time: int):
        """
        Broadcast a match completion event

        Args:
            match_type_key: The key of the match type that completed
            elapsed_time: Time taken for the match operation in seconds
        """
        message = {
            "type": "match_complete",
            "match_type_key": match_type_key,
            "elapsed_time": elapsed_time,
        }

        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send message to client: {e}")
                disconnected_clients.append(connection)

        # Clean up disconnected clients
        for connection in disconnected_clients:
            self.disconnect(connection)


# Global connection manager instance
_connection_manager: ConnectionManager = None


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager instance"""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager
