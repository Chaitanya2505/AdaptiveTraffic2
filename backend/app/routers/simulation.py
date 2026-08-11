from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.sumo_service import sumo_service

router = APIRouter(prefix="/ws", tags=["Simulation"])

@router.websocket("/simulation")
async def websocket_simulation(websocket: WebSocket):
    await websocket.accept()
    await sumo_service.register_client(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await sumo_service.handle_message(websocket, data)
    except WebSocketDisconnect:
        sumo_service.unregister_client(websocket)
    except Exception as e:
        print(f"WebSocket connection error: {e}")
        sumo_service.unregister_client(websocket)
