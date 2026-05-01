#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"
QDRANT_CONTAINER_NAME="${QDRANT_CONTAINER_NAME:-salinig-qdrant}"
QDRANT_IMAGE="${QDRANT_IMAGE:-qdrant/qdrant:latest}"
QDRANT_HTTP_PORT="${QDRANT_HTTP_PORT:-6333}"
QDRANT_GRPC_PORT="${QDRANT_GRPC_PORT:-6334}"
FRONTEND_PID=""

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Qdrant." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the frontend." >&2
  exit 1
fi

if [ ! -x "$UVICORN_BIN" ]; then
  echo "Expected Uvicorn at $UVICORN_BIN but it was not found." >&2
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "Expected frontend package.json at $FRONTEND_DIR but it was not found." >&2
  exit 1
fi

cleanup() {
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    echo
    echo "Stopping frontend dev server..."
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
    wait "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

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

echo "Launching frontend with Next.js on http://localhost:3000"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

sleep 2
if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
  echo "Frontend dev server failed to start." >&2
  wait "$FRONTEND_PID"
  exit 1
fi

echo "Launching backend with Uvicorn on http://localhost:8000"
cd "$BACKEND_DIR"
set +e
"$UVICORN_BIN" app.main:app --reload
BACKEND_STATUS=$?
set -e

exit "$BACKEND_STATUS"
