#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"
QDRANT_CONTAINER_NAME="${QDRANT_CONTAINER_NAME:-salinig-qdrant}"
QDRANT_IMAGE="${QDRANT_IMAGE:-qdrant/qdrant:latest}"
QDRANT_HTTP_PORT="${QDRANT_HTTP_PORT:-6333}"
QDRANT_GRPC_PORT="${QDRANT_GRPC_PORT:-6334}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Qdrant." >&2
  exit 1
fi

if [ ! -x "$UVICORN_BIN" ]; then
  echo "Expected Uvicorn at $UVICORN_BIN but it was not found." >&2
  exit 1
fi

if ! docker ps -a --format '{{.Names}}' | grep -Fxq "$QDRANT_CONTAINER_NAME"; then
  echo "Starting new Qdrant container: $QDRANT_CONTAINER_NAME"
  docker run -d \
    --name "$QDRANT_CONTAINER_NAME" \
    -p "$QDRANT_HTTP_PORT:6333" \
    -p "$QDRANT_GRPC_PORT:6334" \
    "$QDRANT_IMAGE" >/dev/null
elif ! docker ps --format '{{.Names}}' | grep -Fxq "$QDRANT_CONTAINER_NAME"; then
  echo "Starting existing Qdrant container: $QDRANT_CONTAINER_NAME"
  docker start "$QDRANT_CONTAINER_NAME" >/dev/null
else
  echo "Qdrant container is already running: $QDRANT_CONTAINER_NAME"
fi

echo "Waiting for Qdrant on http://localhost:$QDRANT_HTTP_PORT/collections ..."
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$QDRANT_HTTP_PORT/collections" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:$QDRANT_HTTP_PORT/collections" >/dev/null 2>&1; then
  echo "Qdrant did not become ready in time." >&2
  exit 1
fi

echo "Launching backend with Uvicorn on http://localhost:8000"
cd "$BACKEND_DIR"
exec "$UVICORN_BIN" app.main:app --reload
