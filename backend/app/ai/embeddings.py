class EmbeddingService:
    def embed_text(self, text: str) -> dict[str, object]:
        return {"dimensions": 3, "vector": [len(text), len(text.split()), 1]}
