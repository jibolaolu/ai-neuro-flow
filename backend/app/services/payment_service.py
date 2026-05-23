class PaymentService:
    def get_payment_status(self, payment_id: str) -> dict[str, str]:
        return {"payment_id": payment_id, "status": "pending"}
