from fastapi import APIRouter

from app.models.payment import Payment

router = APIRouter()


@router.get("/")
def list_payments() -> dict[str, list[dict[str, object]]]:
    sample = Payment(
        id="payment-001",
        client_id="client-001",
        amount=250.0,
        currency="GBP",
        status="pending",
    )
    return {"items": [sample.model_dump()]}
