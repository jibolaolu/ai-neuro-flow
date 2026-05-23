from app.models.workflow import WorkflowTask


class FormService:
    def build_welcome_pack_task(self, client_name: str, pathway: str) -> WorkflowTask:
        return WorkflowTask(
            key="form_service",
            title="Form service triggered",
            status="complete",
            detail=f"Welcome pack and {pathway} intake forms dispatched to {client_name}.",
        )
