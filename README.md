# SALINIG

SALINIG is a self-learning, agentic intelligence system for public-signal analysis, credibility assessment, sentiment monitoring, and evidence-grounded report generation. It combines a FastAPI backend, a LangGraph cyclic RAG pipeline, Qdrant vector memory, Tavily web retrieval, OpenAI language models, and a Next.js operational console.

The system is designed around context engineering: instead of relying on one large prompt, SALINIG injects context through graph structure, retrieval state, memory recall, sentiment and credibility briefs, quality evaluation, retry feedback, and durable learning notes.

## System Classification

| Aspect | Classification |
| --- | --- |
| Architecture | Self-learning multi-agent-style cyclic RAG system |
| AI Pattern | Agentic AI with tool use, autonomous query generation, retrieval, evaluation, and retry planning |
| Orchestration | LangGraph cyclic state graph with quality-gated control flow |
| Learning | Non-parametric self-learning via Qdrant read-write memory |
| Sentiment | Ensemble sentiment, RoBERTa 40% + LLM 60%, with LLM fallback |
| Credibility | Multi-dimensional LLM credibility assessment over source authority, corroboration, specificity, recency, bias, contradictions, and caution flags |
| Context Engineering | Pipeline-structured knowledge injection through state, memory, evidence, themes, evaluation feedback, and report constraints |

## Core Idea

SALINIG runs a cyclic RAG loop:

```text
query_gen -> research -> analysis -> insight -> evaluate
                                      |
                                      v
                         pass? -> learn -> save -> END
                                      |
                                      v
                         sync learning off? -> complete -> END
                                      |
                                      v
                         retry budget left? -> query_gen
                                      |
                                      v
                         no budget -> finalize -> END
```

The graph improves its own output during a run. If the evaluator finds weak grounding, missing evidence, or low usefulness, the system turns those deficiencies into targeted knowledge gaps, regenerates search queries, retrieves more evidence, and produces a revised report. If the report passes the quality threshold, SALINIG distills durable findings into Qdrant so future runs can recall them.

## Context Engineering by Node

| Node | Context Engineering Mechanism | Implementation |
| --- | --- | --- |
| `query_gen` | Query planning from user intent, place, themes, monitoring window, and prior evaluator gaps | Builds Tavily-ready queries deterministically by default, with optional LLM query generation via `RAG_USE_LLM_QUERY_GEN` |
| `research` | Parallel evidence and memory retrieval | Runs `collect_node` and `memory_node` concurrently with `ThreadPoolExecutor` |
| `collect` | Web evidence acquisition | Uses Tavily advanced search, deduplicates URLs, preserves titles, URLs, published dates, scores, snippets, and raw content |
| `memory` | Memory-augmented context recall | Searches Qdrant with OpenAI embeddings and returns prior learning notes before synthesis |
| `analysis` | Compact auxiliary intelligence | Runs a combined LLM sentiment and credibility assessment, then blends sentiment with RoBERTa scores |
| `insight` | Structured report synthesis | Generates a 9-section decision-ready report using evidence, sentiment, credibility, memory, feedback, and gaps |
| `evaluate` | Quality gate and retry controller | Scores six criteria, computes the weighted score in code, records feedback, and drives pass/retry/finalize routing |
| `learn` | Durable memory distillation | Converts a passing report into reusable memory notes with citations |
| `save` | Persistent systemic learning | Saves learning notes to Qdrant with SHA-256 content-hash deduplication |
| `complete` | Fast accepted exit | Returns a passing report without synchronous memory save when `RAG_SYNC_LEARNING=false` |
| `finalize` | Best-effort terminal path | Promotes the best report when max iterations are exhausted without passing |

## Key Terminology

### 9-Node LangGraph Pipeline

The compiled graph in `backend/app/infrastructure/graph/graph_builder.py` contains 9 named graph nodes:

```text
query_gen, research, analysis, insight, evaluate, learn, save, complete, finalize
```

Two additional worker nodes run inside `research`:

```text
collect_node + memory_node
```

The older standalone `sentiment_node` and `credibility_node` remain available as a parallel fallback if combined analysis fails.

### Cyclic RAG vs DAG

SALINIG is intentionally not a pure DAG. The evaluator can route execution back to `query_gen`, creating a cyclic retrieval and repair loop:

```text
evaluate -> query_gen -> research -> analysis -> insight -> evaluate
```

This loop is bounded by `RAG_MAX_ITERATIONS`.

### Self-Learning vs Model Training

SALINIG learns without updating model weights. It stores distilled, citation-backed learning notes in Qdrant. Later analyses retrieve those notes as prior memory, making the system improve through accumulated state rather than fine-tuning.

## Pipeline Summary

| Stage | File | Function |
| --- | --- | --- |
| Query generation | `backend/app/infrastructure/graph/nodes/query_gen_node.py` | Creates search queries from place, themes, monitoring window, and knowledge gaps |
| Research orchestration | `backend/app/infrastructure/graph/nodes/research_node.py` | Runs web collection and memory retrieval in parallel |
| Web collection | `backend/app/infrastructure/graph/nodes/collect_node.py` | Searches Tavily and formats bounded evidence |
| Memory retrieval | `backend/app/infrastructure/graph/nodes/memory_node.py` | Retrieves prior learning notes from Qdrant |
| Analysis | `backend/app/infrastructure/graph/nodes/analysis_node.py` | Produces sentiment and credibility briefs |
| Sentiment ensemble | `backend/app/infrastructure/graph/nodes/sentiment_ensemble.py` | Blends RoBERTa and LLM sentiment scores |
| Insight synthesis | `backend/app/infrastructure/graph/nodes/insight_node.py` | Writes the structured intelligence report |
| Quality evaluation | `backend/app/infrastructure/graph/nodes/evaluate_node.py` | Scores report quality and controls retries |
| Learning | `backend/app/infrastructure/graph/nodes/learning_node.py` | Distills reusable memory from accepted reports |
| Memory save | `backend/app/infrastructure/graph/nodes/save_node.py` | Persists learning notes with dedupe |
| Completion | `backend/app/infrastructure/graph/nodes/complete_node.py` | Returns accepted reports when sync learning is disabled |
| Finalization | `backend/app/infrastructure/graph/nodes/finalize_node.py` | Returns best attempt after max retries |

## Quality Framework

SALINIG evaluates every generated report across six weighted criteria:

| Criterion | Weight |
| --- | ---: |
| Evidence grounding | 25% |
| Timeframe fit | 15% |
| Source credibility weighting | 20% |
| Specificity and depth | 20% |
| Memory integration | 10% |
| Practical usefulness | 10% |

The LLM returns per-criterion scores, feedback, knowledge gaps, and blocking issues. The backend computes the final weighted score in code and compares it to `RAG_QUALITY_THRESHOLD`.

## Sentiment System

SALINIG uses an ensemble sentiment design:

| Signal | Default Weight | Role |
| --- | ---: | --- |
| RoBERTa | 40% | Fast classifier over bounded evidence chunks using `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| LLM | 60% | Context-aware sentiment reasoning over the evidence pool |

The final response can expose:

- `sentiment_label`
- `sentiment_scores`
- `sentiment_roberta_scores`
- `sentiment_llm_scores`
- `sentiment_roberta_error`

If RoBERTa is unavailable, SALINIG falls back to LLM-only sentiment scoring.

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

Backend entrypoint:

```text
POST /api/v1/analysis/
```

Request body:

```json
{
  "channel": "web_search",
  "monitoring_window": "past 24 hours",
  "prioritize_themes": ["infrastructure"],
  "place": "Baguio City"
}
```

Response includes the final report, quality diagnostics, memory status, retrieved memories, collected source URLs, and `cycle_trace` observability data.

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

The console currently uses local data modules in `frontend/lib/consoleData.ts` and `frontend/lib/landingData.ts`.

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
RAG_MAX_ITERATIONS=3
RAG_QUALITY_THRESHOLD=0.70
RAG_RETRIEVAL_K=3
RAG_SEARCH_MAX_RESULTS=5
RAG_QUERIES_PER_THEME=2
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
```

## Getting Started

### Backend

This repository currently uses the existing virtual environment at `backend/venv`.

```bash
cd backend
../backend/venv/bin/uvicorn app.main:app --reload
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

## Testing

Run the backend tests:

```bash
cd backend
../backend/venv/bin/python -m unittest tests/test_cyclic_rag.py
```

The test suite patches external I/O, including LLM calls, Tavily search, Qdrant retrieval, Qdrant writes, and RoBERTa inference.

Run the frontend linter:

```bash
cd frontend
npm run lint
```

## Key Files

| Area | File |
| --- | --- |
| FastAPI app | `backend/app/main.py` |
| API router | `backend/app/api/v1/router.py` |
| Analysis endpoint | `backend/app/api/v1/endpoints/analysis.py` |
| Analysis service | `backend/app/domain/services/analysis_service.py` |
| Graph builder | `backend/app/infrastructure/graph/graph_builder.py` |
| Graph state | `backend/app/infrastructure/graph/state.py` |
| Tavily search | `backend/app/infrastructure/search/tavily_search.py` |
| Qdrant memory | `backend/app/infrastructure/memory/qdrant_memory.py` |
| OpenAI LLM wrapper | `backend/app/infrastructure/llm/openai_llm.py` |
| Backend tests | `backend/tests/test_cyclic_rag.py` |
| Frontend app shell | `frontend/app/layout.tsx` |
| Landing page | `frontend/app/page.tsx` |
| Console page | `frontend/app/console/page.tsx` |
| Console data | `frontend/lib/consoleData.ts` |
| Landing data | `frontend/lib/landingData.ts` |

## Current Implementation Snapshot

- 9-node LangGraph cyclic RAG pipeline
- Parallel research stage for Tavily collection and Qdrant memory retrieval
- Quality-gated retry loop with actionable knowledge gaps
- Best-report promotion when max iterations are reached
- Self-learning memory writeback for passing reports
- RoBERTa + LLM sentiment ensemble with fallback behavior
- Multi-dimensional credibility brief
- Structured 9-section intelligence report generation
- `cycle_trace` observability returned in API responses
- Next.js console frontend for monitoring and presentation

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

