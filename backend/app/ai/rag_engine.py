from app.ai.embeddings import EmbeddingService


class RAGEngine:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    def retrieve(self, query: str) -> dict[str, object]:
        return {
            "query": query,
            "embedding": self.embedding_service.embed_text(query),
            "matches": [],
        }
