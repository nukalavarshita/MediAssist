import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
import jwt
import mysql.connector
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(
    title="Healthcare Chat Service",
    version="2.0.0",
    description="Conversation orchestration and chat history service.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).with_name("chat_data.json")
SECRET_KEY = os.getenv("JWT_SECRET", "healthcare-secret-key-2024")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8003")
PATIENT_SERVICE_URL = os.getenv("PATIENT_SERVICE_URL", "http://localhost:8002")
USE_LOCAL_STORE = os.getenv("USE_LOCAL_STORE", "true").lower() == "true"
MYSQL_ENABLED = os.getenv("MYSQL_ENABLED", "false").lower() == "true"


class ChatMessage(BaseModel):
    message: str = Field(min_length=3, max_length=2000)
    session_id: Optional[str] = None
    channel: str = "chat"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_store() -> dict[str, Any]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    seeded = {
        "history": [],
        "next_chat_id": 1,
    }
    DATA_FILE.write_text(json.dumps(seeded, indent=2))
    return seeded


def save_store(store: dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(store, indent=2))


def mysql_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "healthcare_db"),
    )


def prefer_mysql() -> bool:
    return MYSQL_ENABLED and not USE_LOCAL_STORE


def get_current_user(authorization: str) -> dict[str, Any]:
    try:
        token = authorization.replace("Bearer ", "")
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def fetch_patient_profile(authorization: str) -> Optional[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{PATIENT_SERVICE_URL}/patient/profile",
                headers={"Authorization": authorization},
            )
            response.raise_for_status()
            return response.json()
    except Exception:
        return None


async def call_ai_service(message: str, patient_info: Optional[dict[str, Any]], authorization: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            f"{AI_SERVICE_URL}/ai/analyze",
            json={"text": message, "patient_info": patient_info},
            headers={"Authorization": authorization},
        )
        response.raise_for_status()
        return response.json()


@app.post("/chat/message")
async def send_message(payload: ChatMessage, authorization: str = Header(...)):
    user = get_current_user(authorization)
    patient_info = await fetch_patient_profile(authorization)
    try:
        ai_result = await call_ai_service(payload.message, patient_info, authorization)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {exc}") from exc

    session_id = payload.session_id or f"session-{user['sub']}"
    history_item = {
        "id": None,
        "user_id": int(user["sub"]),
        "session_id": session_id,
        "channel": payload.channel,
        "user_message": payload.message,
        "ai_response": ai_result,
        "risk_level": ai_result["risk_assessment"]["level"],
        "confidence_score": ai_result["llm_analysis"]["confidence_score"],
        "created_at": now_iso(),
    }

    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO chat_history (
                user_id, session_id, channel, user_message, ai_response,
                risk_level, confidence_score, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                history_item["user_id"],
                history_item["session_id"],
                history_item["channel"],
                history_item["user_message"],
                json.dumps(ai_result),
                history_item["risk_level"],
                history_item["confidence_score"],
            ),
        )
        db.commit()
        history_item["id"] = cursor.lastrowid
        db.close()
    else:
        store = ensure_store()
        history_item["id"] = store["next_chat_id"]
        store["next_chat_id"] += 1
        store["history"].append(history_item)
        save_store(store)

    return {
        "chat_id": history_item["id"],
        "session_id": session_id,
        "user_message": payload.message,
        "ai_response": ai_result,
    }


@app.get("/chat/history")
def get_history(authorization: str = Header(...)):
    user = get_current_user(authorization)
    user_id = int(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, session_id, channel, user_message, ai_response, risk_level,
                   confidence_score, created_at
            FROM chat_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 50
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        db.close()
        for row in rows:
            if isinstance(row["ai_response"], str):
                row["ai_response"] = json.loads(row["ai_response"])
        return rows

    history = [item for item in ensure_store()["history"] if item["user_id"] == user_id]
    return sorted(history, key=lambda item: item["created_at"], reverse=True)


@app.get("/chat/sessions/{session_id}")
def get_session(session_id: str, authorization: str = Header(...)):
    user = get_current_user(authorization)
    history = get_history(authorization)
    session_items = [item for item in history if item["session_id"] == session_id]
    if not session_items:
        raise HTTPException(status_code=404, detail=f"No chat history for session {session_id}")
    return {"user_id": int(user["sub"]), "session_id": session_id, "messages": session_items}


@app.delete("/chat/history/{chat_id}")
def delete_chat(chat_id: int, authorization: str = Header(...)):
    user = get_current_user(authorization)
    user_id = int(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor()
        cursor.execute("DELETE FROM chat_history WHERE id = %s AND user_id = %s", (chat_id, user_id))
        db.commit()
        db.close()
        return {"message": "Deleted"}

    store = ensure_store()
    original_count = len(store["history"])
    store["history"] = [
        item for item in store["history"] if not (item["id"] == chat_id and item["user_id"] == user_id)
    ]
    if len(store["history"]) == original_count:
        raise HTTPException(status_code=404, detail="Chat not found")
    save_store(store)
    return {"message": "Deleted"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "chat",
        "storage_mode": "mysql" if prefer_mysql() else "local-json",
    }
