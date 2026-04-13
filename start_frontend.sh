#!/bin/bash
# Healthcare AI - Start frontend

BASE="$(cd "$(dirname "$0")" && pwd)/frontend/react-app"
echo "Starting React frontend..."
cd "$BASE"
npm install
npm run dev
