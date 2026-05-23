from pydantic import BaseModel, EmailStr


class BookingWorkflowStep(BaseModel):
    key: str
    title: str
    status: str
    detail: str


class BookingRecord(BaseModel):
    id: str
    case_id: str
    client_id: str
    client_name: str
    client_email: EmailStr
    clinician_id: str
    clinician_name: str
    pathway: str
    booking_status: str
    payment_status: str
    room_status: str
    confirmation_status: str
    sla_status: str
    slot_time: str
    source: str
    workflow_steps: list[BookingWorkflowStep]


class BookingWebhookPayload(BaseModel):
    source: str
    client_name: str
    client_email: EmailStr
    pathway: str
    preferred_slot: str
    payment_intent_id: str
    widget_reference: str | None = None
