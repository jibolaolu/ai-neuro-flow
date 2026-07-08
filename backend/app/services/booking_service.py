"""Booking service — DB-backed (SQLite via SQLAlchemy)."""

import uuid
from sqlalchemy.orm import Session

from app.models.booking import BookingRecord, BookingWebhookPayload, BookingWorkflowStep
from app.models.booking_record import BookingDBRecord
from app.services.form_service import FormService
from app.services.notification_service import NotificationService
from app.services.report_workflow_service import ReportWorkflowService
from app.services.session_brief_service import SessionBriefService


class BookingService:
    def __init__(self) -> None:
        self.notification_service = NotificationService()
        self.form_service = FormService()
        self.session_brief_service = SessionBriefService()
        self.report_workflow_service = ReportWorkflowService()

    # ── DB helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _get_db() -> Session:
        from app.db.session import SessionLocal  # lazy to avoid circular import
        return SessionLocal()

    # ── Public API ─────────────────────────────────────────────────────────

    def list_bookings(self, db: Session | None = None) -> list[dict]:
        """Return all bookings, most recent first."""
        _own_db = db is None
        if _own_db:
            db = self._get_db()
        try:
            rows = db.query(BookingDBRecord).order_by(BookingDBRecord.created_at.desc()).all()
            return [r.to_dict() for r in rows]
        finally:
            if _own_db:
                db.close()

    def get_booking(self, booking_id: str, db: Session | None = None) -> BookingRecord | None:
        _own_db = db is None
        if _own_db:
            db = self._get_db()
        try:
            row = db.query(BookingDBRecord).filter(BookingDBRecord.id == booking_id).first()
            if not row:
                return None
            return self._row_to_model(row)
        finally:
            if _own_db:
                db.close()

    def process_payment_webhook(self, payload: BookingWebhookPayload, db: Session | None = None) -> BookingRecord:
        _own_db = db is None
        if _own_db:
            db = self._get_db()
        try:
            existing_count = db.query(BookingDBRecord).count()
            sequence = existing_count + 1
            new_id = f"booking-{uuid.uuid4().hex[:8]}"
            case_id = f"case-{1000 + sequence}"

            form_task = self.form_service.build_welcome_pack_task(payload.client_name, payload.pathway)
            brief_task = self.session_brief_service.build_task("Dr Jordan Lee", payload.preferred_slot)
            handoff_task = self.report_workflow_service.build_task("drafting")

            steps = [
                {"key": "slot_resolver", "title": "Slot resolver", "status": "complete",
                 "detail": "Availability store and clinician match resolved the slot."},
                {"key": "payment_gate", "title": "Stripe payment gate", "status": "complete",
                 "detail": f"PaymentIntent {payload.payment_intent_id} accepted."},
                {"key": "case_creator", "title": "Case creator", "status": "complete",
                 "detail": f"Client record created with case ID {case_id}."},
                {"key": "confirmation_dispatch", "title": "Confirmation dispatch", "status": "complete",
                 "detail": self.notification_service.build_calendar_invite_status(
                     "Dr Jordan Lee", payload.preferred_slot)},
                form_task.model_dump(),
                brief_task.model_dump(),
                handoff_task.model_dump(),
            ]

            row = BookingDBRecord(
                id=new_id,
                case_id=case_id,
                client_id=f"client-{sequence:03d}",
                client_name=payload.client_name,
                client_email=str(payload.client_email),
                clinician_id="clinician-001",
                clinician_name="Dr Jordan Lee",
                pathway=payload.pathway,
                booking_status="scheduled",
                payment_status="paid",
                room_status="provisioned",
                confirmation_status="sent",
                sla_status="on_track",
                slot_time=payload.preferred_slot,
                source=payload.source,
            )
            row.workflow_steps = steps

            db.add(row)
            db.commit()
            db.refresh(row)

            return self._row_to_model(row)
        finally:
            if _own_db:
                db.close()

    # ── Private ────────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_model(row: BookingDBRecord) -> BookingRecord:
        return BookingRecord(
            id=row.id,
            case_id=row.case_id,
            client_id=row.client_id,
            client_name=row.client_name,
            client_email=row.client_email,
            clinician_id=row.clinician_id or "",
            clinician_name=row.clinician_name or "",
            pathway=row.pathway,
            booking_status=row.booking_status,
            payment_status=row.payment_status,
            room_status=row.room_status,
            confirmation_status=row.confirmation_status,
            sla_status=row.sla_status,
            slot_time=row.slot_time or "",
            source=row.source or "",
            workflow_steps=[BookingWorkflowStep(**s) for s in row.workflow_steps],
        )
