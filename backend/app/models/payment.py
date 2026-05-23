from pydantic import BaseModel


class Payment(BaseModel):
    id: str
    client_id: str
    amount: float
    currency: str
    status: str
