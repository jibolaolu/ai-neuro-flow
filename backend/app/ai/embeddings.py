"""
Real embedding service backed by sentence-transformers via ChromaDB.

Uses all-MiniLM-L6-v2 (90 MB, downloaded once on first use) — no API key required.
Lazy-imports chromadb so the app starts even before the package is installed.
"""

from __future__ import annotations

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_ef():
    """Return the ChromaDB default embedding function (sentence-transformers)."""
    try:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        from app.core.config import settings
        return SentenceTransformerEmbeddingFunction(model_name=settings.embedding_model)
    except ImportError:
        logger.warning("chromadb / sentence-transformers not installed — embeddings disabled")
        return None


class EmbeddingService:
    def embed_text(self, text: str) -> dict[str, object]:
        ef = _get_ef()
        if ef is None:
            # graceful degradation: deterministic stub so callers don't break
            return {"dimensions": 0, "vector": [], "model": "unavailable"}

        try:
            vectors = ef([text])   # returns list of list[float]
            vec = vectors[0]
            return {
                "dimensions": len(vec),
                "vector": vec,
                "model": "all-MiniLM-L6-v2",
            }
        except Exception as exc:
            logger.error("embed_text failed: %s", exc)
            return {"dimensions": 0, "vector": [], "error": str(exc)}

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts; returns empty lists on failure."""
        ef = _get_ef()
        if ef is None or not texts:
            return [[] for _ in texts]
        try:
            return list(ef(texts))
        except Exception as exc:
            logger.error("embed_batch failed: %s", exc)
            return [[] for _ in texts]
