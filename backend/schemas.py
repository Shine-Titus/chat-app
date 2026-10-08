from pydantic import BaseModel
from datetime import datetime

class UserResponse(BaseModel):
    id: int
    username: str
    
    model_config = {
        "from_attributes": True
    }

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    content: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }