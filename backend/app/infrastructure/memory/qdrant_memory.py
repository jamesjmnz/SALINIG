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

def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(
            url=settings.QDRANT_URL,
            timeout=int(settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS),
        )

        if not _client.collection_exists(settings.QDRANT_COLLECTION):
            _client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(
                    size=settings.OPENAI_EMBEDDING_DIMENSIONS,
                    distance=Distance.COSINE,
                ),
            )
    return _client


def _get_store() -> QdrantVectorStore:
    global _store
    if _store is None:
        client = _get_client()
        embeddings = OpenAIEmbeddings(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EMBEDDING_MODEL,
            dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS,
            timeout=settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS,
            max_retries=settings.EXTERNAL_MAX_RETRIES,
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


def _point_id_for_hash(content_hash: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, content_hash))


def _content_hash_exists(content_hash: str) -> bool:
    client = _get_client()
    records = client.retrieve(
        collection_name=settings.QDRANT_COLLECTION,
        ids=[_point_id_for_hash(content_hash)],
        with_payload=False,
        with_vectors=False,
        timeout=int(settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS),
    )
    return bool(records)


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

    point_id = _point_id_for_hash(content_hash)
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
