#!/bin/bash
# Healthcare AI - Start all backend services

set -e
BASE="$(cd "$(dirname "$0")" && pwd)/backend"

echo "Starting Healthcare AI Backend Services..."

# Copy .env to each service
for svc in auth-service patient-service chat-service ai-service vector-service api-gateway; do
  cp "$BASE/.env" "$BASE/$svc/.env" 2>/dev/null || true
done

start_service() {
  local name=$1
  local dir=$2
  local port=$3
  echo "Starting $name on port $port..."
  cd "$dir"
  if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -q -r requirements.txt
  else
    source venv/bin/activate
  fi
  uvicorn main:app --host 0.0.0.0 --port "$port" --reload &
  echo "$name PID: $!"
  cd "$BASE/.."
}

start_service "Auth Service"       "$BASE/auth-service"    8001
start_service "Patient Service"    "$BASE/patient-service" 8002
start_service "AI Service"         "$BASE/ai-service"      8003
start_service "Vector Service"     "$BASE/vector-service"  8004
start_service "Chat Service"       "$BASE/chat-service"    8005
start_service "API Gateway"        "$BASE/api-gateway"     8000

echo ""
echo "All services started!"
echo "  API Gateway:     http://localhost:8000"
echo "  Auth Service:    http://localhost:8001"
echo "  Patient Service: http://localhost:8002"
echo "  AI Service:      http://localhost:8003"
echo "  Vector Service:  http://localhost:8004"
echo "  Chat Service:    http://localhost:8005"
echo ""
echo "Press Ctrl+C to stop all services"
wait
