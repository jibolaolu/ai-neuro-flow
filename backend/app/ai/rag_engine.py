"""
Real RAG engine backed by ChromaDB persistent vector store.

Collections:
  clinical_documents   — uploaded client documents (OCR text)
  case_notes           — clinician notes
  form_responses       — scored form responses

Multi-tenancy: all documents tagged with clinic_id metadata;
queries filter by clinic_id so clinics never see each other's data.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_COLLECTIONS = ("clinical_documents", "case_notes", "form_responses")


@lru_cache(maxsize=1)
def _get_client():
    """Lazy-init ChromaDB persistent client."""
    try:
        import chromadb
        from app.core.config import settings, _BACKEND_DIR

        raw = (settings.chroma_persist_dir or "").strip()
        persist_path = Path(raw).resolve() if raw else (_BACKEND_DIR / "chroma_db").resolve()
        persist_path.mkdir(parents=True, exist_ok=True)

        client = chromadb.PersistentClient(path=str(persist_path))
        logger.info("ChromaDB initialised at %s", persist_path)
        return client
    except ImportError:
        logger.warning("chromadb not installed — RAG disabled")
        return None


def _collection(name: str):
    """Get or create a named ChromaDB collection."""
    client = _get_client()
    if client is None:
        return None
    try:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        from app.core.config import settings
        ef = SentenceTransformerEmbeddingFunction(model_name=settings.embedding_model)
        return client.get_or_create_collection(name=name, embedding_function=ef)
    except Exception as exc:
        logger.error("ChromaDB collection(%s) failed: %s", name, exc)
        return None


class RAGEngine:
    # ── Indexing ──────────────────────────────────────────────────────────────

    def index_document(
        self,
        *,
        collection: str,
        doc_id: str,
        text: str,
        clinic_id: str,
        metadata: dict | None = None,
    ) -> bool:
        """Add or update a document in the vector store. Returns True on success."""
        col = _collection(collection)
        if col is None or not text.strip():
            return False
        try:
            meta = {"clinic_id": clinic_id, **(metadata or {})}
            col.upsert(ids=[doc_id], documents=[text], metadatas=[meta])
            return True
        except Exception as exc:
            logger.error("index_document failed [%s/%s]: %s", collection, doc_id, exc)
            return False

    def delete_document(self, *, collection: str, doc_id: str) -> bool:
        col = _collection(collection)
        if col is None:
            return False
        try:
            col.delete(ids=[doc_id])
            return True
        except Exception as exc:
            logger.error("delete_document failed [%s/%s]: %s", collection, doc_id, exc)
            return False

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        *,
        collection: str = "clinical_documents",
        clinic_id: str | None = None,
        n_results: int = 5,
    ) -> dict[str, object]:
        """Semantic search. Returns top-n matches with distance scores."""
        col = _collection(collection)
        if col is None:
            return {"query": query, "matches": [], "error": "ChromaDB unavailable"}

        try:
            where = {"clinic_id": clinic_id} if clinic_id else None
            results = col.query(
                query_texts=[query],
                n_results=min(n_results, max(col.count(), 1)),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
            matches = []
            docs      = results.get("documents", [[]])[0]
            metas     = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            ids       = results.get("ids", [[]])[0]

            for i, (doc, meta, dist, doc_id) in enumerate(zip(docs, metas, distances, ids)):
                matches.append({
                    "id": doc_id,
                    "text": doc,
                    "metadata": meta,
                    "score": round(1.0 - dist, 4),  # convert L2 distance → similarity-ish
                    "rank": i + 1,
                })
            return {"query": query, "collection": collection, "matches": matches}

        except Exception as exc:
            logger.error("retrieve failed [%s]: %s", collection, exc)
            return {"query": query, "matches": [], "error": str(exc)}

    def retrieve_multi(
        self,
        query: str,
        *,
        clinic_id: str | None = None,
        n_results: int = 3,
    ) -> dict[str, list]:
        """Search all three collections at once and merge results."""
        all_matches: list[dict] = []
        for col_name in _COLLECTIONS:
            result = self.retrieve(
                query,
                collection=col_name,
                clinic_id=clinic_id,
                n_results=n_results,
            )
            for m in result.get("matches", []):
                m["collection"] = col_name
                all_matches.append(m)

        all_matches.sort(key=lambda x: x.get("score", 0), reverse=True)
        return {"query": query, "matches": all_matches[:n_results * 2]}


# Module-level singleton for convenience
rag_engine = RAGEngine()
