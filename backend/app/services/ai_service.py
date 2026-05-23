from app.ai.prompts.report_generation import REPORT_GENERATION_PROMPT


class AIService:
    def generate_report_summary(self, notes: str) -> str:
        return f"{REPORT_GENERATION_PROMPT} | Source length: {len(notes)}"
