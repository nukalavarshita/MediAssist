import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title="Healthcare API Gateway",
    version="2.0.0",
    description="Gateway and facade for the healthcare AI microservices.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICES = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://localhost:8001"),
    "patient": os.getenv("PATIENT_SERVICE_URL", "http://localhost:8002"),
    "ai": os.getenv("AI_SERVICE_URL", "http://localhost:8003"),
    "vector": os.getenv("VECTOR_SERVICE_URL", "http://localhost:8004"),
    "chat": os.getenv("CHAT_SERVICE_URL", "http://localhost:8005"),
}


async def proxy(service: str, request: Request, upstream_path: str) -> Response:
    base_url = SERVICES.get(service)
    if not base_url:
        raise HTTPException(status_code=404, detail="Service not found")

    async with httpx.AsyncClient(timeout=45.0) as client:
        upstream_response = await client.request(
            method=request.method,
            url=f"{base_url}/{upstream_path}",
            headers={key: value for key, value in request.headers.items() if key.lower() != "host"},
            content=await request.body(),
            params=request.query_params,
        )

    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers={"content-type": upstream_response.headers.get("content-type", "application/json")},
    )


@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def auth_proxy(path: str, request: Request):
    return await proxy("auth", request, f"auth/{path}")


@app.api_route("/api/patient/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def patient_proxy(path: str, request: Request):
    return await proxy("patient", request, f"patient/{path}")


@app.api_route("/api/chat/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def chat_proxy(path: str, request: Request):
    return await proxy("chat", request, f"chat/{path}")


@app.api_route("/api/ai/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def ai_proxy(path: str, request: Request):
    return await proxy("ai", request, f"ai/{path}")


@app.api_route("/api/vector/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def vector_proxy(path: str, request: Request):
    return await proxy("vector", request, f"vector/{path}")


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    async with httpx.AsyncClient(timeout=10.0) as client:
        health = {}
        for name, url in SERVICES.items():
            try:
                response = await client.get(f"{url}/health")
                health[name] = response.json()
            except Exception:
                health[name] = {"status": "unreachable"}
    return {"platform": "Healthcare Decision Support System", "services": health}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway", "services": SERVICES}
