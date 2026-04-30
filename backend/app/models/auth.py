from typing import Optional
from pydantic import BaseModel


class TokenPayload(BaseModel):
    aud: str
    iss: str
    sub: str
    preferred_username: Optional[str] = None
    name: Optional[str] = None
    oid: Optional[str] = None
