# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

The project is a Python FastAPI backend. There is no `requirements.txt` — the venv at `backend/venv` is used directly.

```bash
# Start the API server (from repo root)
cd backend && ../backend/venv/bin/uvicorn app.main:app --reload

# Run all tests (from repo root)
cd backend && ../backend/venv/bin/python -m pytest tests/

# Run a single test file
cd backend && ../backend/venv/bin/python -m unittest tests/test_cyclic_rag.py

# Run a single test case
cd backend && ../backend/venv/bin/python -m unittest tests.test_cyclic_rag.CyclicRagTests.test_success_path_saves_distilled_learning_and_returns_diagnostics
```

## Environment

Config is loaded by `pydantic_settings` from `../.env` relative to `backend/` (i.e., the repo root `.env`). Required variables: `OPENAI_API_KEY`, `TAVILY_API_KEY`, `QDRANT_URL`, `QDRANT_COLLECTION`, `OPENAI_MODEL`. Qdrant must be running locally on port 6333 for non-test runs.

Tunable RAG parameters (with defaults): `RAG_MAX_ITERATIONS=3`, `RAG_QUALITY_THRESHOLD=0.70`, `RAG_RETRIEVAL_K=3`, `RAG_SEARCH_MAX_RESULTS=5`, `RAG_QUERIES_PER_THEME=2`, `RAG_EVIDENCE_CHAR_LIMIT=25000`, `RAG_SOURCE_CHAR_LIMIT=3500`, `RAG_USE_LLM_QUERY_GEN=false`, `RAG_SYNC_LEARNING=true`, `RAG_AUX_ANALYSIS_CHAR_LIMIT=3500`.

## Architecture

Single endpoint: `POST /api/v1/analysis/` → `AnalysisService.analyze()` → `salinig_graph.invoke()`.

The core is a **LangGraph cyclic RAG pipeline** defined in `backend/app/infrastructure/graph/`. The graph state (`SalinigState`) flows through these nodes in order:

```
query_gen → research(web collect + memory in parallel) → analysis(combined sentiment + credibility) → insight → evaluate
                                                                                                           ↓
                                                                                             quality_passed? ──yes──→ learn → save → END
                                                                                                           ↓
                                                                                             sync learning off ──yes──→ complete → END
                                                                                                           ↓
                                                                                             iteration < max? ──yes──→ (back to query_gen)
                                                                                                           ↓
                                                                                                      finalize → END
```

**Node responsibilities:**
- `query_gen_node` — generates targeted Tavily queries deterministically by default; optional LLM generation is controlled by `RAG_USE_LLM_QUERY_GEN`; on retry iterations, prioritizes evaluator `knowledge_gaps`
- `research_node` — runs Tavily collection and Qdrant memory retrieval concurrently
- `collect_node` — searches Tavily for the generated queries and preserves richer bounded evidence text
- `memory_node` — retrieves relevant prior learnings from Qdrant via semantic search
- `analysis_node` — runs one concise combined LLM assessment for sentiment and credibility, with the older parallel nodes as a fallback
- `insight_node` — LLM generates the structured research report (9-section format when iteration notes are needed)
- `evaluate_node` — LLM scores 6 criteria, code computes the weighted quality score, and diagnostics control whether the loop retries or exits
- `learning_node` — distills the passing report into a durable memory note when `RAG_SYNC_LEARNING=true`
- `save_node` — persists the learning note to Qdrant with deduplication by SHA-256 content hash
- `complete_node` — returns a passing report immediately when synchronous learning is disabled
- `finalize_node` — reached when max iterations are exhausted without passing; promotes the best-scoring report from the cycle

Every node writes a structured entry to `cycle_trace` via `trace.append_trace()`, which is returned in the API response for observability.

**Infrastructure singletons** (`qdrant_memory.py`): `_client` and `_store` are module-level singletons initialized lazily; the Qdrant collection is auto-created on first use with `text-embedding-3-small` (1536-dim cosine).

## Testing approach

Tests in `tests/test_cyclic_rag.py` use `unittest` + `unittest.mock.patch`. All external I/O (LLM calls, Tavily search, Qdrant reads/writes) is patched — tests run without real API keys or a running Qdrant instance. The env vars are set at the top of the test file before any app imports.
