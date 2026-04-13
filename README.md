# Healthcare AI Decision Support System

A full-stack healthcare decision support platform built with FastAPI microservices and a React/Vite frontend.

## Architecture

Backend services:
- `backend/api-gateway` on `8000`
- `backend/auth-service` on `8001`
- `backend/patient-service` on `8002`
- `backend/ai-service` on `8003`
- `backend/vector-service` on `8004`
- `backend/chat-service` on `8005`

Frontend:
- `frontend/react-app` on `5173`

## Features

- JWT authentication
- Patient profile and medical history timeline
- AI chat consultation flow
- Multi-agent AI orchestration
- RAG retrieval with Pinecone support and local fallback
- Gemini primary LLM with OpenAI fallback
- Research assistant and consultation preparation summary
- Risk classification, doctor suggestions, tests, and follow-up questions
- Local JSON persistence for demos, optional MySQL for production-style local setups

## Local setup

### 1. Backend environment

Copy values from `backend/.env.example` into `backend/.env` and adjust as needed.

### 2. Start each FastAPI service

In separate terminals:

```bash
cd backend/auth-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8001
cd backend/patient-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8002
cd backend/ai-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8003
cd backend/vector-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8004
cd backend/chat-service && pip install -r requirements.txt && uvicorn main:app --reload --port 8005
cd backend/api-gateway && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd frontend/react-app
npm install
npm run dev
```

## Demo credentials

- Email: `demo@healthcare.ai`
- Password: `DemoPass123!`

## Storage modes

- Default: local JSON files per service, so the app runs immediately.
- Optional: set `MYSQL_ENABLED=true` and `USE_LOCAL_STORE=false` to use MySQL-backed auth, patient, and chat data.
- Optional: set `USE_PINECONE=true` plus `PINECONE_API_KEY` and `GEMINI_API_KEY` to enable Pinecone retrieval.

## Notes

- This project is for decision support and education, not medical diagnosis.
- No Git or GitHub workflow is required anywhere in the project.
