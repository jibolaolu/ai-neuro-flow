from app.models.booking import BookingRecord, BookingWebhookPayload, BookingWorkflowStep
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
        self._bookings: list[BookingRecord] = [
            BookingRecord(
                id="booking-001",
                case_id="case-1001",
                client_id="client-001",
                client_name="Alex Taylor",
                client_email="alex@example.com",
                clinician_id="clinician-001",
                clinician_name="Dr Jordan Lee",
                pathway="Adult ADHD",
                booking_status="scheduled",
                payment_status="paid",
                room_status="provisioned",
                confirmation_status="sent",
                sla_status="on_track",
                slot_time="2026-04-16T09:00:00",
                source="WordPress widget",
                workflow_steps=[
                    BookingWorkflowStep(
                        key="slot_resolver",
                        title="Slot resolver",
                        status="complete",
                        detail="Clinician and room slot allocated.",
                    ),
                    BookingWorkflowStep(
                        key="payment_gate",
                        title="Stripe payment gate",
                        status="complete",
                        detail="PaymentIntent confirmed and webhook received.",
                    ),
                    BookingWorkflowStep(
                        key="case_creator",
                        title="Case creator",
                        status="complete",
                        detail="Client record and case ID created.",
                    ),
                    BookingWorkflowStep(
                        key="confirmation_dispatch",
                        title="Confirmation dispatch",
                        status="complete",
                        detail="Email and calendar invite queued.",
                    ),
                    BookingWorkflowStep(
                        key="form_service",
                        title="Form service triggered",
                        status="complete",
                        detail="Welcome pack and intake forms dispatched.",
                    ),
                    BookingWorkflowStep(
                        key="session_brief",
                        title="Session briefer",
                        status="queued",
                        detail="Pre-session briefing scheduled for clinician.",
                    ),
                    BookingWorkflowStep(
                        key="assessment_report_handoff",
                        title="Assessment + report handoff",
                        status="in_progress",
                        detail="Case routed into assessment and report pipeline.",
                    ),
                ],
            ),
            BookingRecord(
                id="booking-002",
                case_id="case-1002",
                client_id="client-002",
                client_name="Maya Singh",
                client_email="maya@example.com",
                clinician_id="clinician-002",
                clinician_name="Dr Samir Patel",
                pathway="Adult Autism",
                booking_status="awaiting_confirmation",
                payment_status="paid",
                room_status="pending",
                confirmation_status="pending",
                sla_status="watch",
                slot_time="2026-04-18T13:30:00",
                source="Client portal",
                workflow_steps=[
                    BookingWorkflowStep(
                        key="slot_resolver",
                        title="Slot resolver",
                        status="complete",
                        detail="Slot reserved with clinician preference match.",
                    ),
                    BookingWorkflowStep(
                        key="payment_gate",
                        title="Stripe payment gate",
                        status="complete",
                        detail="PaymentIntent confirmed and booking unlocked.",
                    ),
                    BookingWorkflowStep(
                        key="case_creator",
                        title="Case creator",
                        status="complete",
                        detail="Case record created and workflow tracked.",
                    ),
                    BookingWorkflowStep(
                        key="confirmation_dispatch",
                        title="Confirmation dispatch",
                        status="in_progress",
                        detail="Waiting for room provisioning before send.",
                    ),
                    BookingWorkflowStep(
                        key="form_service",
                        title="Form service triggered",
                        status="pending",
                        detail="Welcome pack will dispatch after confirmation send.",
                    ),
                    BookingWorkflowStep(
                        key="session_brief",
                        title="Session briefer",
                        status="pending",
                        detail="Briefing remains blocked until booking confirmation completes.",
                    ),
                    BookingWorkflowStep(
                        key="assessment_report_handoff",
                        title="Assessment + report handoff",
                        status="pending",
                        detail="Assessment workflow will start after pre-session readiness is complete.",
                    ),
                ],
            ),
        ]

    def list_bookings(self) -> list[dict[str, object]]:
        return [booking.model_dump() for booking in self._bookings]

    def get_booking(self, booking_id: str) -> BookingRecord | None:
        for booking in self._bookings:
            if booking.id == booking_id:
                return booking
        return None

    def process_payment_webhook(self, payload: BookingWebhookPayload) -> BookingRecord:
        sequence = len(self._bookings) + 1
        form_task = self.form_service.build_welcome_pack_task(payload.client_name, payload.pathway)
        brief_task = self.session_brief_service.build_task("Dr Jordan Lee", payload.preferred_slot)
        handoff_task = self.report_workflow_service.build_task("drafting")
        booking = BookingRecord(
            id=f"booking-{sequence:03d}",
            case_id=f"case-{1000 + sequence}",
            client_id=f"client-{sequence:03d}",
            client_name=payload.client_name,
            client_email=payload.client_email,
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
            workflow_steps=[
                BookingWorkflowStep(
                    key="slot_resolver",
                    title="Slot resolver",
                    status="complete",
                    detail="Availability store and clinician match resolved the slot.",
                ),
                BookingWorkflowStep(
                    key="payment_gate",
                    title="Stripe payment gate",
                    status="complete",
                    detail=f"PaymentIntent {payload.payment_intent_id} accepted.",
                ),
                BookingWorkflowStep(
                    key="case_creator",
                    title="Case creator",
                    status="complete",
                    detail=f"Client record created with case ID case-{1000 + sequence}.",
                ),
                BookingWorkflowStep(
                    key="confirmation_dispatch",
                    title="Confirmation dispatch",
                    status="complete",
                    detail=self.notification_service.build_calendar_invite_status(
                        "Dr Jordan Lee",
                        payload.preferred_slot,
                    ),
                ),
                BookingWorkflowStep(**form_task.model_dump()),
                BookingWorkflowStep(**brief_task.model_dump()),
                BookingWorkflowStep(**handoff_task.model_dump()),
            ],
        )
        self._bookings.insert(0, booking)
        return booking
