# SALINIG

SALINIG is a Philippines-first, self-learning, agentic intelligence system for public-signal analysis, credibility assessment, sentiment monitoring, and evidence-grounded report generation. It combines a FastAPI backend, a LangGraph cyclic RAG pipeline, Qdrant vector memory, Tavily web retrieval, OpenAI language models, and a Next.js operational console.

The system is designed around context engineering: instead of relying on one large prompt, SALINIG injects context through graph structure, retrieval state, memory recall, sentiment and credibility briefs, quality evaluation, retry feedback, and durable learning notes.

## System Classification

| Aspect              | Classification                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture        | Self-learning multi-agent-style cyclic RAG system                                                                                                |
| AI Pattern          | Agentic AI with tool use, autonomous query generation, retrieval, evaluation, and retry planning                                                 |
| Orchestration       | LangGraph cyclic state graph with quality-gated control flow                                                                                     |
| Learning            | Non-parametric self-learning via Qdrant read-write memory                                                                                        |
| Sentiment           | Ensemble sentiment, RoBERTa 40% + LLM 60%, with LLM fallback                                                                                     |
| Credibility         | Multi-dimensional LLM credibility assessment over source authority, corroboration, specificity, recency, bias, contradictions, and caution flags |
| Context Engineering | Pipeline-structured knowledge injection through state, memory, evidence, themes, evaluation feedback, and report constraints                     |

## Core Idea

The graph improves its own output during a run. If the evaluator finds weak grounding, missing evidence, or low usefulness, the system turns those deficiencies into targeted knowledge gaps, regenerates search queries, retrieves more evidence, and produces a revised report. If the report passes the quality threshold, SALINIG distills durable findings into Qdrant so future runs can recall them.

## Context Engineering by Node

| Node        | Context Engineering Mechanism                                                               | Implementation                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `query_gen` | Query planning from user intent, place, themes, monitoring window, and prior evaluator gaps | Builds Tavily-ready queries deterministically by default, with optional LLM query generation via `RAG_USE_LLM_QUERY_GEN`   |
| `research`  | Parallel evidence and memory retrieval                                                      | Runs `collect_node` and `memory_node` concurrently with `ThreadPoolExecutor`                                               |
| `collect`   | Web evidence acquisition                                                                    | Fans out Tavily queries in parallel, deduplicates URLs, preserves titles, URLs, published dates, scores, snippets, and optional raw content |
| `memory`    | Memory-augmented context recall                                                             | Searches Qdrant with OpenAI embeddings and returns prior learning notes before synthesis                                   |
| `analysis`  | Compact auxiliary intelligence                                                              | Runs a combined LLM sentiment and credibility assessment, then blends sentiment with RoBERTa scores                        |
| `insight`   | Structured sentiment-report synthesis                                                       | Generates an overall sentiment brief, source-level signals, weighted metrics, and actionable insights                       |
| `citation_validation` | Citation integrity guard                                                           | Checks that cited URLs and `Src:` labels in the rendered report exist in collected evidence                                 |
| `evaluate`  | Quality gate and retry controller                                                           | Scores six criteria, computes the weighted score in code, records feedback, and drives pass/retry/finalize routing         |
| `learn`     | Durable memory distillation                                                                 | Converts a passing report into reusable memory notes with citations                                                        |
| `save`      | Persistent systemic learning                                                                | Saves learning notes to Qdrant with SHA-256 content-hash deduplication                                                     |
| `complete`  | Fast accepted exit                                                                          | Returns a passing report without synchronous memory save when `RAG_SYNC_LEARNING=false`                                    |
| `finalize`  | Best-effort terminal path                                                                   | Promotes the best report when max iterations are exhausted without passing                                                 |

## Key Terminology

### 10-Node LangGraph Pipeline

The compiled graph in `backend/app/infrastructure/graph/graph_builder.py` contains 10 named graph nodes:

```text
query_gen, research, analysis, insight, citation_validation, evaluate, learn, save, complete, finalize
```

Two additional worker nodes run inside `research`:

```text
collect_node + memory_node
```

The older standalone `sentiment_node` and `credibility_node` remain available as a parallel fallback if combined analysis fails.

### Cyclic RAG vs DAG

SALINIG is intentionally not a pure DAG. The evaluator can route execution back to `query_gen`, creating a cyclic retrieval and repair loop:

```text
evaluate -> query_gen -> research -> analysis -> insight -> citation_validation -> evaluate
```

This loop is bounded by `RAG_MAX_ITERATIONS`.

### Self-Learning vs Model Training

SALINIG learns without updating model weights. It stores distilled, citation-backed learning notes in Qdrant. Later analyses retrieve those notes as prior memory, making the system improve through accumulated state rather than fine-tuning.

## Quality Framework

SALINIG evaluates every generated report across six weighted criteria:

| Criterion                    | Weight |
| ---------------------------- | -----: |
| Evidence grounding           |    25% |
| Timeframe fit                |    15% |
| Source credibility weighting |    20% |
| Specificity and depth        |    20% |
| Memory integration           |    10% |
| Practical usefulness         |    10% |

The LLM returns per-criterion scores, feedback, knowledge gaps, and blocking issues. The backend computes the final weighted score in code and compares it to `RAG_QUALITY_THRESHOLD`.

## Sentiment System

SALINIG uses an ensemble sentiment design:

| Signal  | Default Weight | Role                                                                                                  |
| ------- | -------------: | ----------------------------------------------------------------------------------------------------- |
| RoBERTa |            40% | Fast classifier over bounded evidence chunks using `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| LLM     |            60% | Context-aware sentiment reasoning over the evidence pool                                              |

The final response can expose:

- `sentiment_label`
- `sentiment_scores`
- `sentiment_roberta_scores`
- `sentiment_llm_scores`
- `sentiment_roberta_error`
- `sentiment_report`

If RoBERTa is unavailable, SALINIG falls back to LLM-only sentiment scoring.

The rendered `sentiment_report` contains:

- `overall_label` and `overview`
- `source_signals` for every collected source, each with summary, sentiment, verification, credibility, and credibility score
- credibility-weighted metrics for `negative_pct`, `neutral_pct`, `positive_pct`, `credibility_pct`, `verified_pct`, `misinfo_risk_pct`, and `signal_count`
- up to 5 `actionable_insights`

## Memory System

Memory is implemented in `backend/app/infrastructure/memory/qdrant_memory.py`.

- Embeddings: OpenAI `text-embedding-3-small` by default
- Vector size: 1536
- Distance: cosine
- Store: Qdrant
- Deduplication: SHA-256 hash of normalized learning-note content
- Memory type: `learning_note`

The memory loop is:

```text
memory_node retrieves prior learning -> insight_node uses memory -> learning_node distills accepted report -> save_node writes back to Qdrant
```

## API

Backend base path:

```text
/api/v1/analysis
```

Implemented analysis endpoints:

| Method | Path                      | Purpose                                                                 |
| ------ | ------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/v1/analysis/`       | Run a synchronous analysis and return the final response                |
| `POST` | `/api/v1/analysis/stream` | Run an analysis as Server-Sent Events with node-by-node progress        |
| `GET`  | `/api/v1/analysis/latest` | Return the latest cached successful analysis without diagnostics        |
| `GET`  | `/api/v1/analysis/options` | Return supported Philippine locations, categories, and UI defaults     |

Additional service endpoints:

- `GET /` for a root status payload
- `GET /health` for liveness
- `GET /ready` for readiness, including the active OpenAI model and Qdrant collection

Request body:

```json
{
  "channel": "web_search",
  "monitoring_window": "past 24 hours",
  "prioritize_themes": ["Transportation & Infrastructure"],
  "focus_terms": ["road clearing", "flood alerts"],
  "place": "Baguio City",
  "analysis_mode": "fast_draft",
  "include_diagnostics": true
}
```

Request behavior and validation:

- `channel` is currently fixed to `web_search`
- `monitoring_window` supports `past 24 hours`, `past 7 days`, and `past 30 days`
- `place` is normalized to a supported Philippine scope only; non-Philippine locations are rejected
- `prioritize_themes` must map to the fixed SALINIG public-intelligence categories, with alias normalization such as `infrastructure` -> `Transportation & Infrastructure`
- `focus_terms` accepts optional free-form subthemes and is deduplicated
- `analysis_mode` supports:
  - `fast_draft`: 1 cycle, basic Tavily depth, up to 6 queries, no RoBERTa, no synchronous learning save
  - `full`: configured retry budget, advanced Tavily depth, raw-content retrieval, RoBERTa enabled, optional synchronous learning save
- `include_diagnostics` is `false` by default; when enabled it returns search queries, collected sources, retrieved memories, learning-note details, citation validation, and full `cycle_trace`

Response highlights:

- `final_report`: rendered analyst-facing report text
- `sentiment_report`: structured report object for the frontend
- `quality`: canonical quality object with score, breakdown, pass/fail, feedback, knowledge gaps, and blocking issues
- `memory_saved` and `memory_duplicate`: Qdrant writeback status
- transitional fields such as `quality_score` and `quality_breakdown` are still returned for existing callers

Security and runtime protections:

- If `SALINIG_API_KEY` is set, requests must include `X-API-Key`
- Analysis endpoints apply an in-memory per-client or per-key rate limit
- `/latest` caches only quality-passing analyses and strips diagnostics before storage
- Citation validation runs before evaluation; unsupported citations reduce quality and create actionable blocking issues

## Frontend

The frontend is a Next.js 16 and React 19 console located in `frontend/`.

Current UI areas include:

- Landing page
- Dashboard
- Live signals
- Verification queue
- Sentiment analysis
- Reports
- Data sources
- Agent monitor
- Settings

Current frontend behavior:

- The console loads analysis options from `GET /api/analysis/options`
- On load, it fetches the latest cached successful report from `GET /api/analysis/latest`
- New runs are executed through `POST /api/analysis/stream`, and the UI renders live node progress from Server-Sent Events
- Next.js route handlers in `frontend/app/api/analysis/*` proxy requests to the backend and forward the optional API key
- `Sentiment`, `Reports`, and parts of `Dashboard` and `Signals` render live backend analysis when available
- `Verify`, `Sources`, and `Agents` currently remain demo/sample views backed by `frontend/lib/consoleData.ts`

## Tech Stack

### Backend

- Python
- FastAPI
- LangGraph
- LangChain
- OpenAI Chat API via `langchain_openai`
- OpenAI embeddings
- Tavily search
- Qdrant vector database
- HuggingFace Transformers for RoBERTa sentiment
- Pydantic and Pydantic Settings
- SQLite LLM cache through LangChain

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- ESLint

## Environment Variables

The backend loads environment variables from the root `.env` file through `backend/app/core/config.py`.

Required:

```bash
OPENAI_API_KEY=
TAVILY_API_KEY=
QDRANT_URL=
QDRANT_COLLECTION=
OPENAI_MODEL=
```

Optional tuning:

```bash
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
RAG_MAX_ITERATIONS=3
RAG_QUALITY_THRESHOLD=0.70
RAG_RETRIEVAL_K=3
RAG_SEARCH_MAX_RESULTS=5
RAG_QUERIES_PER_THEME=2
RAG_MAX_THEMES=5
RAG_MAX_SEARCH_QUERIES=10
RAG_SEARCH_MAX_WORKERS=4
RAG_SIGNAL_MAX_WORKERS=4
RAG_EVIDENCE_CHAR_LIMIT=25000
RAG_SOURCE_CHAR_LIMIT=3500
RAG_USE_LLM_QUERY_GEN=false
RAG_SYNC_LEARNING=true
RAG_AUX_ANALYSIS_CHAR_LIMIT=3500
RAG_SENTIMENT_ROBERTA_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest
RAG_SENTIMENT_ROBERTA_WEIGHT=0.40
RAG_SENTIMENT_LLM_WEIGHT=0.60
RAG_SENTIMENT_ROBERTA_MAX_SOURCES=8
RAG_SENTIMENT_ROBERTA_CHUNK_CHAR_LIMIT=1000
RAG_ENABLE_ROBERTA=true
RAG_WARM_ROBERTA_ON_STARTUP=false
EXTERNAL_REQUEST_TIMEOUT_SECONDS=30
EXTERNAL_MAX_RETRIES=2
SALINIG_API_KEY=
SALINIG_RATE_LIMIT_REQUESTS=20
SALINIG_RATE_LIMIT_WINDOW_SECONDS=60
SALINIG_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Frontend/runtime proxy variables:

```bash
SALINIG_API_BASE=http://localhost:8000/api/v1
NEXT_PUBLIC_SALINIG_API_BASE=http://localhost:8000/api/v1
NEXT_PUBLIC_SALINIG_PROXY_BASE=/api
NEXT_PUBLIC_SALINIG_API_KEY=
```

## Getting Started

### Backend

This repository currently uses the existing virtual environment at `backend/venv`.

```bash
cd backend
../backend/venv/bin/uvicorn app.main:app --reload
```

If you want one shortcut that starts Qdrant and then launches the backend:

```bash
./run_backend_stack.sh
```

The API will be available at:

```text
http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

By default, the frontend proxy expects the backend at `http://localhost:8000/api/v1`. Override this with `SALINIG_API_BASE` if needed.

## Testing

Run the backend tests:

```bash
cd backend
../backend/venv/bin/python -m unittest tests/test_cyclic_rag.py
```

The test suite patches external I/O, including LLM calls, Tavily search, Qdrant retrieval, Qdrant writes, and RoBERTa inference.

Coverage includes:

- cyclic retry and best-report promotion behavior
- streaming endpoint contract
- request validation, API-key enforcement, and rate limiting
- citation validation penalties
- query-budget controls and fast-draft/full mode behavior
- sentiment-report rendering and source-signal metrics

Run the frontend linter:

```bash
cd frontend
npm run lint
```

## Key Files

| Area                    | File                                                 |
| ----------------------- | ---------------------------------------------------- |
| FastAPI app             | `backend/app/main.py`                                |
| API router              | `backend/app/api/v1/router.py`                       |
| Analysis endpoint       | `backend/app/api/v1/endpoints/analysis.py`           |
| Analysis service        | `backend/app/domain/services/analysis_service.py`    |
| Request/response schema | `backend/app/schemas/analysis_schema.py`             |
| Input defaults          | `backend/app/domain/analysis_defaults.py`            |
| Security and rate limit | `backend/app/core/security.py`, `backend/app/core/rate_limit.py` |
| Latest-analysis cache   | `backend/app/domain/services/analysis_cache.py`      |
| Graph builder           | `backend/app/infrastructure/graph/graph_builder.py`  |
| Graph state             | `backend/app/infrastructure/graph/state.py`          |
| Tavily search           | `backend/app/infrastructure/search/tavily_search.py` |
| Qdrant memory           | `backend/app/infrastructure/memory/qdrant_memory.py` |
| OpenAI LLM wrapper      | `backend/app/infrastructure/llm/openai_llm.py`       |
| Backend tests           | `backend/tests/test_cyclic_rag.py`                   |
| Frontend app shell      | `frontend/app/layout.tsx`                            |
| Console page            | `frontend/app/console/page.tsx`                      |
| Frontend proxy routes   | `frontend/app/api/analysis/*`                        |
| Frontend API client     | `frontend/lib/analysisApi.ts`                        |
| Proxy adapter           | `frontend/lib/salinigProxy.ts`                       |
| Console demo data       | `frontend/lib/consoleData.ts`                        |
| Landing data            | `frontend/lib/landingData.ts`                        |

## Current Implementation Snapshot

- 10-node LangGraph cyclic RAG pipeline
- Parallel research stage for Tavily collection and Qdrant memory retrieval
- Parallel source-signal generation for each collected source
- Quality-gated retry loop with actionable knowledge gaps
- Best-report promotion when max iterations are reached
- Self-learning memory writeback for passing reports
- RoBERTa + LLM sentiment ensemble with fallback behavior
- Multi-dimensional credibility brief
- Citation validation before quality scoring
- Structured sentiment report with source-level signals, weighted metrics, and actionable insights
- Streaming analysis progress over SSE
- Latest successful analysis cache for frontend bootstrapping
- Philippines-first location and category normalization
- `cycle_trace` observability returned in API responses
- Next.js proxy-backed console frontend for monitoring and presentation

## Research Contribution

SALINIG's main architectural contribution is structural context engineering: the workflow itself carries domain intent, temporal scope, retrieval evidence, prior memory, quality feedback, and durable learning across specialized stages. This creates a stronger inductive bias than a single prompt because each stage constrains and enriches the next one.

The result is a bounded, inspectable, self-improving RAG system that can:

- Retrieve current evidence
- Recall historical memory
- Analyze sentiment and credibility
- Generate structured reports
- Evaluate its own output
- Retry with targeted gaps
- Store reusable learning for future analysis
