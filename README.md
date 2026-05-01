# SALINIG

SALINIG is a Philippines-first, self-learning, agentic intelligence system for public-signal analysis, credibility assessment, sentiment monitoring, and evidence-grounded report generation. It combines a FastAPI backend, a LangGraph cyclic RAG pipeline, Qdrant vector memory, Tavily web retrieval, OpenAI language models, and a Next.js operational console.

The system is designed around context engineering: instead of relying on one large prompt, SALINIG injects context through graph structure, retrieval state, memory recall, sentiment and credibility briefs, quality evaluation, retry feedback, and durable learning notes.

## System Classification

| Aspect              | Classification                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture        | Self-learning multi-agent-style cyclic RAG system                                                                                                |
| AI Pattern          | Agentic AI with tool use, autonomous query generation, retrieval, evaluation, and retry planning                                                 |
| Orchestration       | LangGraph cyclic state graph with evidence-gated and quality-gated control flow                                                                  |
| Learning            | Non-parametric self-learning via Qdrant read-write memory                                                                                        |
| Sentiment           | Ensemble sentiment, `cardiffnlp/twitter-roberta-base-sentiment-latest` 40% + LLM 60%, with LLM fallback                                         |
| Credibility         | Multi-dimensional LLM credibility assessment over source authority, corroboration, specificity, recency, bias, contradictions, and caution flags |
| Hugging Face Models | `cardiffnlp/twitter-roberta-base-sentiment-latest` for sentiment, `BAAI/bge-reranker-v2-m3` for source reranking, and `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` for claim verification |
| Context Engineering | Pipeline-structured knowledge injection through state, memory, evidence, verification, themes, evaluation feedback, and report constraints       |

## Core Idea

The graph improves its own output during a run. If the evaluator finds weak grounding, missing evidence, or low usefulness, the system turns those deficiencies into targeted knowledge gaps, regenerates search queries, retrieves more evidence, and produces a revised report. If the collected evidence is too thin, SALINIG stops before synthesis rather than forcing a weak report. If the report passes the quality threshold, SALINIG distills durable findings into Qdrant so future runs can recall them.

## Context Engineering by Node

| Node        | Context Engineering Mechanism                                                               | Implementation                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `query_gen` | Query planning from user intent, place, themes, monitoring window, and prior evaluator gaps | Builds query targets from evaluator `knowledge_gaps`, else `focus_terms`, else categories; generates Tavily-ready queries deterministically by default, with optional LLM query generation via `RAG_USE_LLM_QUERY_GEN` |
| `research`  | Parallel evidence and memory retrieval                                                      | Runs `collect_node` and `memory_node` concurrently with `ThreadPoolExecutor`                                               |
| `collect`   | Web evidence acquisition                                                                    | Fans out Tavily queries in parallel, deduplicates by URL, reranks sources with `BAAI/bge-reranker-v2-m3` with heuristic fallback, preserves titles, URLs, published dates, scores, snippets, and optional raw content, then compacts evidence text to per-mode limits |
| `memory`    | Memory-augmented context recall                                                             | Searches Qdrant with OpenAI embeddings and returns prior learning notes before synthesis                                   |
| `evidence_gate` | Minimum evidence sufficiency guard                                                      | Checks ranked-source count, unique-domain count, and official-source count before synthesis; returns an early insufficient-evidence result when thresholds are not met |
| `analysis`  | Compact auxiliary intelligence                                                              | Runs a combined LLM sentiment and credibility assessment, then blends sentiment with RoBERTa scores from `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| `insight`   | Structured sentiment-report synthesis                                                       | Generates an overall sentiment brief, then parallel source-level signals for every collected source, credibility-weighted metrics, and actionable insights |
| `claim_verification` | Claim-to-source support checking                                                    | Maps report claims back to ranked evidence and classifies them as supported, mixed, contradicted, or unsupported using `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` with heuristic fallback |
| `citation_validation` | Citation integrity guard                                                           | Checks that cited URLs and `Src:` labels in the rendered report exist in collected evidence                                 |
| `evaluate`  | Quality gate and retry controller                                                           | Scores six criteria, computes the weighted score in code, records feedback, and drives pass/retry/finalize routing         |
| `learn`     | Durable memory distillation                                                                 | Converts a passing report into reusable memory notes with citations                                                        |
| `save`      | Persistent systemic learning                                                                | Saves learning notes to Qdrant with SHA-256 content-hash deduplication                                                     |
| `complete`  | Fast accepted exit                                                                          | Returns a passing report without synchronous memory save when `RAG_SYNC_LEARNING=false`                                    |
| `finalize`  | Best-effort terminal path                                                                   | Promotes the best report when max iterations are exhausted without passing                                                 |
| `insufficient_evidence` | Early terminal safeguard                                                         | Returns a structured stop result with reasons and next-step guidance when the evidence gate fails                          |

## Key Terminology

### 13-Node LangGraph Pipeline

The compiled graph in `backend/app/infrastructure/graph/graph_builder.py` contains 13 named graph nodes:

```text
query_gen, research, evidence_gate, analysis, insight, claim_verification, citation_validation, evaluate, learn, save, complete, finalize, insufficient_evidence
```

Two additional worker nodes run inside `research`:

```text
collect_node + memory_node
```

The older standalone `sentiment_node` and `credibility_node` remain available as a parallel fallback if combined analysis fails.

### Cyclic RAG vs DAG

SALINIG is intentionally not a pure DAG. The evaluator can route execution back to `query_gen`, creating a cyclic retrieval and repair loop:

```text
evaluate -> query_gen -> research -> evidence_gate -> analysis -> insight -> claim_verification -> citation_validation -> evaluate
```

This loop is bounded by `RAG_MAX_ITERATIONS`. If the evidence gate fails first, the graph exits through `insufficient_evidence` instead of entering synthesis and evaluation.

### Self-Learning vs Model Training

SALINIG learns without updating model weights. It stores distilled, citation-backed learning notes in Qdrant. Later analyses retrieve those notes as prior memory, making the system improve through accumulated state rather than fine-tuning. Separately, analyst feedback is stored as a review dataset for QA and fine-tuning-readiness tracking; it does not currently modify graph behavior during a run.

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

Additional quality controls in code:

- citation validation can cap evidence-grounding and source-credibility scores when the rendered report cites unsupported URLs or `Src:` labels
- claim verification can cap evidence-grounding and source-credibility scores when mapped claims are contradicted or remain weakly supported
- the best-scoring report is retained across retries and promoted if the run exhausts its iteration budget without passing

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

Implementation notes:

- Source-level signals are generated in parallel with `ThreadPoolExecutor`
- If source-level drafting fails for a source, SALINIG falls back to a deterministic source summary instead of dropping that signal
- If the draft under-covers the evidence pool, the report is topped up so `source_signals` still covers all collected sources
- When source-level signals are available, `overall_label` is derived from the credibility-weighted source sentiment mix rather than only the model-level sentiment label

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

| Method | Path                               | Purpose                                                                 |
| ------ | ---------------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/v1/analysis/`                | Run a synchronous analysis and return the final response                |
| `POST` | `/api/v1/analysis/stream`          | Run an analysis as Server-Sent Events with node-by-node progress        |
| `GET`  | `/api/v1/analysis/latest`          | Return the most recent saved/cached analysis record for console bootstrap |
| `GET`  | `/api/v1/analysis/saved`           | List archived saved-report summaries for the console                    |
| `POST` | `/api/v1/analysis/saved`           | Persist a report to the saved-report archive                            |
| `GET`  | `/api/v1/analysis/saved/{reportId}` | Return the full archived report record for a saved report               |
| `GET`  | `/api/v1/analysis/options`         | Return supported Philippine locations, categories, and UI defaults      |
| `POST` | `/api/v1/analysis/feedback`        | Store analyst review labels, notes, and flagged claim IDs              |
| `GET`  | `/api/v1/analysis/feedback`        | List stored analyst feedback records                                    |
| `GET`  | `/api/v1/analysis/feedback/export` | Export analyst feedback plus fine-tuning-readiness summary              |

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
- `focus_terms` is capped by the same `RAG_MAX_THEMES` limit used for `prioritize_themes`
- `analysis_mode` supports:
  - `fast_draft`: 1 cycle, basic Tavily depth, up to 6 queries, no RoBERTa, no synchronous learning save
  - `full`: configured retry budget, advanced Tavily depth, raw-content retrieval, RoBERTa enabled, optional synchronous learning save
- `include_diagnostics` is `false` by default; when enabled it returns search queries, collected sources, retrieved memories, evidence sufficiency, claim verification, citation validation, learning-note details, and full `cycle_trace`

Response highlights:

- `final_report`: rendered analyst-facing report text
- `sentiment_report`: structured report object for the frontend
- `analysis_status`: `completed` or `insufficient_evidence`
- `quality`: canonical quality object with score, breakdown, pass/fail, feedback, knowledge gaps, and blocking issues
- `memory_saved` and `memory_duplicate`: Qdrant writeback status
- transitional fields such as `quality_score` and `quality_breakdown` are still returned for existing callers

Saved-report archive behavior:

- `POST /api/v1/analysis/saved` accepts a full `AnalysisResponse` payload and persists a sanitized copy with heavy diagnostics cleared while keeping presentation-safe verification summaries
- Saved reports are stored newest-first in `backend/.salinig/saved_reports.json` by default, configurable via `SALINIG_SAVED_REPORTS_PATH`
- Archive length is capped by `SALINIG_SAVED_REPORTS_LIMIT`
- Reports that did not pass the quality gate can still be saved; the frontend surfaces those as review items in the archive
- `GET /api/v1/analysis/latest` returns the newest archived/cached record when one exists, otherwise `cached: false`

Analyst feedback behavior:

- feedback records are stored in `backend/.salinig/analyst_feedback.json` by default, configurable via `SALINIG_ANALYST_FEEDBACK_PATH`
- each record can include `report_id`, 1-5 score, usefulness/accuracy labels, optional notes, flagged claim IDs, and free-form tags
- the export endpoint returns a readiness summary based on feedback volume, positive useful examples, inaccurate examples, average score, and the most frequently flagged claim IDs

Security and runtime protections:

- If `SALINIG_API_KEY` is set, requests must include `X-API-Key`
- Analysis endpoints apply an in-memory per-client or per-key rate limit
- Saved-report storage strips bulky diagnostic content before persistence so archived records stay presentation-friendly
- Evidence sufficiency gating can stop a run before synthesis when minimum source/domain thresholds are not met
- Citation validation runs before evaluation; unsupported citations reduce quality and create actionable blocking issues
- Claim verification runs before evaluation; contradicted or unsupported mapped claims reduce quality and surface review issues

## Frontend

The frontend is a Next.js 16 and React 19 console located in `frontend/`.

Current UI areas include:

- Landing page
- Dashboard
- Live signals
- Verification workspace
- Sentiment analysis runner
- Saved reports archive
- Settings

Current frontend behavior:

- The console loads analysis options from `GET /api/analysis/options`
- On load, it fetches the latest archived bootstrap report from `GET /api/analysis/latest`
- New runs are executed through `POST /api/analysis/stream`, and the UI renders live node progress from Server-Sent Events
- Next.js route handlers in `frontend/app/api/analysis/*` proxy requests to the backend and forward the optional API key
- The frontend requests diagnostics by default for both synchronous and streaming analysis calls
- `Sentiment` lets users choose place, monitoring window, analysis mode, categories, and comma-separated focus terms before launching a run
- `Sentiment` can save the current run to the archive, including runs that failed the quality gate
- `Reports` is backed by the saved-report archive endpoints and loads both summary and detail records
- `Signals` renders backend `sentiment_report` rows and annotates them with claim-support status when verification data is available
- `Verify` renders evidence-sufficiency results, claim-to-evidence mappings, contradiction alerts, and an analyst feedback form backed by `/api/analysis/feedback`
- `Verify` also loads feedback export statistics so reviewers can monitor feedback-dataset health for future fine-tuning experiments
- `Signals`, `Verify`, and the live portions of `Dashboard` render backend `sentiment_report` data when available
- `Dashboard` still includes demo-only credibility trend and agent-status cards when no dedicated backend feed exists
- `Settings` is currently a presentational/local-state console surface rather than a persisted backend configuration panel

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
- HuggingFace Transformers for RoBERTa sentiment, reranking, and NLI claim verification
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
RAG_ENABLE_RERANKING=true
RAG_RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RAG_RERANK_TOP_K=8
RAG_ENABLE_EVIDENCE_SUFFICIENCY_GATE=true
RAG_MIN_SOURCES_REQUIRED=2
RAG_MIN_UNIQUE_DOMAINS_REQUIRED=2
RAG_MIN_OFFICIAL_SOURCES_REQUIRED=0
RAG_ENABLE_NLI_VERIFICATION=true
RAG_NLI_MODEL=MoritzLaurer/mDeBERTa-v3-base-mnli-xnli
RAG_MAX_CLAIMS_TO_VERIFY=8
RAG_MAX_SOURCES_PER_CLAIM=3
EXTERNAL_REQUEST_TIMEOUT_SECONDS=30
EXTERNAL_MAX_RETRIES=2
SALINIG_API_KEY=
SALINIG_RATE_LIMIT_REQUESTS=20
SALINIG_RATE_LIMIT_WINDOW_SECONDS=60
SALINIG_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
SALINIG_SAVED_REPORTS_PATH=backend/.salinig/saved_reports.json
SALINIG_ANALYST_FEEDBACK_PATH=backend/.salinig/analyst_feedback.json
SALINIG_SAVED_REPORTS_LIMIT=50
```

Frontend/runtime proxy variables:

```bash
SALINIG_API_BASE=http://localhost:8000/api/v1
NEXT_PUBLIC_SALINIG_API_BASE=http://localhost:8000/api/v1
NEXT_PUBLIC_SALINIG_PROXY_BASE=/api
SALINIG_API_KEY=
NEXT_PUBLIC_SALINIG_API_KEY=
```

## Getting Started

### Backend

This repository currently uses the existing virtual environment at `backend/venv`.

```bash
cd backend
../backend/venv/bin/uvicorn app.main:app --reload
```

If you want one shortcut that starts Qdrant, the frontend, and then launches the backend:

```bash
./run_backend_stack.sh
```

The services will be available at:

```text
Frontend: http://localhost:3000
Backend API: http://localhost:8000
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
- saved-report archive creation, listing, detail retrieval, and latest bootstrap behavior
- evidence sufficiency gating and insufficient-evidence early termination
- claim verification diagnostics and analyst feedback export behavior
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
| Saved-report cache/archive | `backend/app/domain/services/analysis_cache.py`   |
| Analyst feedback store  | `backend/app/domain/services/analysis_feedback.py`   |
| Graph builder           | `backend/app/infrastructure/graph/graph_builder.py`  |
| Graph state             | `backend/app/infrastructure/graph/state.py`          |
| Evidence gate           | `backend/app/infrastructure/graph/nodes/evidence_gate_node.py` |
| Claim verification      | `backend/app/infrastructure/graph/nodes/claim_verification_node.py` |
| Citation validation     | `backend/app/infrastructure/graph/nodes/citation_validation_node.py` |
| Tavily search           | `backend/app/infrastructure/search/tavily_search.py` |
| Source reranking        | `backend/app/infrastructure/rerank/hf_reranker.py`   |
| NLI verification        | `backend/app/infrastructure/verification/hf_nli.py`  |
| Qdrant memory           | `backend/app/infrastructure/memory/qdrant_memory.py` |
| OpenAI LLM wrapper      | `backend/app/infrastructure/llm/openai_llm.py`       |
| Backend tests           | `backend/tests/test_cyclic_rag.py`                   |
| Frontend app shell      | `frontend/app/layout.tsx`                            |
| Console page            | `frontend/app/console/page.tsx`                      |
| Frontend proxy routes   | `frontend/app/api/analysis/*`                        |
| Frontend API client     | `frontend/lib/analysisApi.ts`                        |
| Proxy adapter           | `frontend/lib/salinigProxy.ts`                       |
| Verification workspace  | `frontend/components/console/views/VerifyView.tsx`   |
| Console demo data       | `frontend/lib/consoleData.ts`                        |
| Landing data            | `frontend/lib/landingData.ts`                        |

## Current Implementation Snapshot

- 13-node LangGraph cyclic RAG pipeline with early insufficient-evidence termination
- Parallel research stage for Tavily collection and Qdrant memory retrieval
- Ranked-source reranking before synthesis and evidence gating
- Parallel source-signal generation for each collected source
- Quality-gated retry loop with actionable knowledge gaps
- Best-report promotion when max iterations are reached
- Self-learning memory writeback for passing reports
- RoBERTa + LLM sentiment ensemble with fallback behavior
- Multi-dimensional credibility brief
- Claim-to-evidence verification with NLI and heuristic fallback
- Citation validation before quality scoring
- Structured sentiment report with source-level signals, weighted metrics, and actionable insights
- Streaming analysis progress over SSE
- File-backed saved-report archive plus latest-report bootstrap for the frontend
- File-backed analyst feedback capture and fine-tuning-readiness summary export
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
