class NotificationService:
    def build_booking_confirmation(self, recipient_name: str) -> str:
        return f"Booking confirmed for {recipient_name}."

    def build_calendar_invite_status(self, clinician_name: str, slot_time: str) -> str:
        return f"Invite queued for {clinician_name} at {slot_time}."
