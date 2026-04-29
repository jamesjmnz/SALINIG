import hashlib
import uuid
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from app.core.config import settings

_store: QdrantVectorStore | None = None
_client: QdrantClient | None = None

EMBEDDING_DIM = 1536  # text-embedding-ada-002 / text-embedding-3-small default


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.QDRANT_URL)

        existing = [c.name for c in _client.get_collections().collections]
        if settings.QDRANT_COLLECTION not in existing:
            _client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )
    return _client


def _get_store() -> QdrantVectorStore:
    global _store
    if _store is None:
        client = _get_client()
        embeddings = OpenAIEmbeddings(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EMBEDDING_MODEL,
        )
        _store = QdrantVectorStore(
            client=client,
            collection_name=settings.QDRANT_COLLECTION,
            embedding=embeddings,
        )
    return _store


def make_content_hash(text: str) -> str:
    normalized = " ".join(text.split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _metadata_from_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {}
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return payload


def _content_hash_exists(content_hash: str) -> bool:
    client = _get_client()
    offset = None
    while True:
        records, offset = client.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for record in records:
            metadata = _metadata_from_payload(record.payload)
            if metadata.get("content_hash") == content_hash:
                return True
        if offset is None:
            return False


def retrieve(query: str, k: int | None = None) -> str:
    result = retrieve_with_diagnostics(query, k=k)
    return result["context"]


def retrieve_with_diagnostics(query: str, k: int | None = None) -> dict[str, Any]:
    if not query.strip():
        return {"context": "", "memories": [], "error": None}

    docs = _get_store().similarity_search_with_score(
        query,
        k=k or settings.RAG_RETRIEVAL_K,
    )
    memories = []
    for doc, score in docs:
        memories.append(
            {
                "content": doc.page_content,
                "metadata": doc.metadata or {},
                "score": score,
            }
        )

    return {
        "context": "\n\n".join(memory["content"] for memory in memories),
        "memories": memories,
        "error": None,
    }


def save(text: str):
    return save_learning(text, {})


def save_learning(text: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized = " ".join((text or "").split())
    if not normalized:
        return {
            "saved": False,
            "duplicate": False,
            "error": "empty learning note",
        }

    content_hash = make_content_hash(normalized)
    if _content_hash_exists(content_hash):
        return {
            "saved": False,
            "duplicate": True,
            "content_hash": content_hash,
            "error": None,
        }

    payload = dict(metadata or {})
    payload["content_hash"] = content_hash
    payload["memory_type"] = "learning_note"

    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, content_hash))
    ids = _get_store().add_texts(
        [normalized],
        metadatas=[payload],
        ids=[point_id],
    )
    return {
        "saved": True,
        "duplicate": False,
        "content_hash": content_hash,
        "ids": ids,
        "error": None,
    }
