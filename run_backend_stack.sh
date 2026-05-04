#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
QDRANT_CONTAINER_NAME="${QDRANT_CONTAINER_NAME:-salinig-qdrant}"
QDRANT_IMAGE="${QDRANT_IMAGE:-qdrant/qdrant:latest}"
QDRANT_HTTP_PORT="${QDRANT_HTTP_PORT:-6333}"
QDRANT_GRPC_PORT="${QDRANT_GRPC_PORT:-6334}"
ENV_FILE="$ROOT_DIR/.env"
DOCKER_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
FRONTEND_PID=""
UVICORN_BIN=""

find_uvicorn_bin() {
  local candidate=""
  for candidate in \
    "$ROOT_DIR/.venv/bin/uvicorn" \
    "$BACKEND_DIR/.venv/bin/uvicorn" \
    "$BACKEND_DIR/venv/bin/uvicorn"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

start_qdrant() {
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$QDRANT_CONTAINER_NAME"; then
    if docker ps --format '{{.Names}}' | grep -Fxq "$QDRANT_CONTAINER_NAME"; then
      echo "Qdrant container is already running: $QDRANT_CONTAINER_NAME"
    else
      echo "Starting existing Qdrant container: $QDRANT_CONTAINER_NAME"
      docker start "$QDRANT_CONTAINER_NAME" >/dev/null
    fi
    return 0
  fi

  if [ -f "$DOCKER_COMPOSE_FILE" ] && docker compose version >/dev/null 2>&1; then
    echo "Starting Qdrant with docker compose"
    docker compose up -d qdrant >/dev/null
    return 0
  fi

  echo "Starting new Qdrant container: $QDRANT_CONTAINER_NAME"
  docker run -d \
    --name "$QDRANT_CONTAINER_NAME" \
    -p "$QDRANT_HTTP_PORT:6333" \
    -p "$QDRANT_GRPC_PORT:6334" \
    "$QDRANT_IMAGE" >/dev/null
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Qdrant." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the frontend." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env and fill in your API keys first." >&2
  exit 1
fi

if ! UVICORN_BIN="$(find_uvicorn_bin)"; then
  echo "Could not find a backend virtualenv with Uvicorn." >&2
  echo "Create one with: python3 -m venv .venv && ./.venv/bin/pip install -r backend/requirements.txt" >&2
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

start_qdrant

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
if [ ! -d node_modules ]; then
  echo "Frontend dependencies are missing. Run 'cd frontend && npm install' first." >&2
  exit 1
fi
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
