#!/bin/bash
# Healthcare AI - Initialize database and seed Pinecone vector store

BASE="$(cd "$(dirname "$0")" && pwd)/backend"
source "$BASE/.env" 2>/dev/null || true

echo "=== Setting up Healthcare AI ==="

# 1. Create MySQL database and tables
echo "Creating MySQL schema..."
mysql -h "${DB_HOST:-localhost}" -u "${DB_USER:-root}" -p"${DB_PASSWORD}" < "$BASE/schema.sql"
echo "Database ready."

# 2. Seed Pinecone vector store
echo "Seeding Pinecone vector store..."
cd "$BASE/vector-service"
if [ ! -d "venv" ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
else
  source venv/bin/activate
fi
python3 -c "
import requests, time
print('Waiting for vector service...')
time.sleep(2)
r = requests.post('http://localhost:8004/vector/upsert')
print('Seeded:', r.json())
"
echo "Setup complete!"
