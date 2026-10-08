"""
Realtime timetable broadcasts over WebSocket (/ws/timetable).

Endpoints call `broadcast_timetable(...)`. It works from both async endpoints
(running on the event loop) and sync endpoints (running in FastAPI's threadpool,
where asyncio.create_task() would fail because there's no running loop).
"""
import asyncio
from anyio.from_thread import run as run_from_thread
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)


timetable_manager = ConnectionManager()


def broadcast_timetable(message: dict):
    """Fire-and-forget broadcast, safe to call from sync or async code."""
    try:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            # Sync endpoint in a worker thread: hop onto the event loop and wait for delivery
            run_from_thread(timetable_manager.broadcast, message)
        else:
            # Already on the event loop (async endpoint): schedule it
            asyncio.get_running_loop().create_task(timetable_manager.broadcast(message))
    except Exception as e:
        print(f"[realtime] WebSocket broadcast error: {e}")
