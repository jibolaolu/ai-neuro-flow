from app.models.workflow import SessionBrieferPayload, WorkflowTask


class SessionBriefService:
    def build_task(self, clinician_name: str, session_time: str) -> WorkflowTask:
        return WorkflowTask(
            key="session_brief",
            title="Session briefer",
            status="queued",
            detail=f"30-minute briefing scheduled before {session_time} for {clinician_name}.",
        )

    def build_payload(
        self,
        case_id: str,
        client_name: str,
        clinician_name: str,
        session_time: str,
    ) -> SessionBrieferPayload:
        return SessionBrieferPayload(
            case_id=case_id,
            client_name=client_name,
            clinician_name=clinician_name,
            session_time=session_time,
            summary=(
                f"{client_name} requires a focused pre-session brief covering intake completeness, "
                f"presenting concerns, and evidence gaps before {session_time}."
            ),
        )
