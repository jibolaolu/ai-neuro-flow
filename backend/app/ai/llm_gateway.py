from app.core.config import settings


class LLMGateway:
    def get_model_metadata(self) -> dict[str, str]:
        return {"provider": "anthropic", "model": settings.anthropic_model}
