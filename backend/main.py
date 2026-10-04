from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from sqlalchemy import select
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket
import json

from database import engine, Base, SessionLocal
from models import User, Message

from schemas import (
    UserResponse,
    MessageCreate,
    MessageResponse
)

print("RUNNING FILE:", __file__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
       await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

        if not users:
            session.add_all([
                User(username="User 1"),
                User(username="User 2")
            ])

            await session.commit()

    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.activate_connections = {}

    async def connect(self, user_id, websocket):
        await websocket.accept()
        self.activate_connections[user_id] = websocket

    def disconnect(self, user_id):
        self.activate_connections.pop(user_id, None)

    async def send_message(self, user_id, message):
        websocket = self.activate_connections.get(user_id)
        if websocket:
            await websocket.send_text(message)

    async def broadcast(self, message):
        for websocket in self.activate_connections.values():
            await websocket.send_text(message)

manager = ConnectionManager()


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)

    try:
        while True:
            message = await websocket.receive_text()

            async with SessionLocal() as session:
                new_message = Message(
                    sender_id=user_id,
                    content=message
                )

                session.add(new_message)

                await session.commit()
                await session.refresh(new_message)

            message_data = json.dumps({
                "id": new_message.id,
                "sender_id": new_message.sender_id,
                "content": new_message.content,
                "created_at": new_message.created_at.isoformat(),
            })

            await manager.broadcast(message_data)
    except Exception:
        manager.disconnect(user_id)

@app.get("/")
def root():
    return {"message": "Chat backend is running"}

@app.get("/users", response_model=list[UserResponse])
async def get_users():
    async with SessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

        return users

@app.post("/messages", response_model=MessageResponse)
async def create_message(message: MessageCreate):
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.id == message.sender_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        new_msg = Message(
            sender_id = message.sender_id,
            content = message.content
        )

        session.add(new_msg)
        await session.commit()
        await session.refresh(new_msg)

        return new_msg

@app.get("/messages", response_model=list[MessageResponse])
async def get_messages():
    async with SessionLocal() as session:
        results = await session.execute(select(Message))
        messages = results.scalars().all()

        return messages

print("REGISTERED ROUTES:")

for route in app.routes:
    print(
        type(route).__name__,
        route.path
    )