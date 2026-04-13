import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import jwt
import mysql.connector
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(
    title="Healthcare Patient Service",
    version="2.0.0",
    description="Patient profile, timeline, and medical history service.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).with_name("patient_data.json")
SECRET_KEY = os.getenv("JWT_SECRET", "healthcare-secret-key-2024")
USE_LOCAL_STORE = os.getenv("USE_LOCAL_STORE", "true").lower() == "true"
MYSQL_ENABLED = os.getenv("MYSQL_ENABLED", "false").lower() == "true"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=120)
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[list[str]] = None
    chronic_conditions: Optional[list[str]] = None
    medications: Optional[list[str]] = None
    emergency_contact: Optional[str] = None
    preferred_doctors: Optional[list[str]] = None


class HealthLog(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    notes: Optional[str] = None
    severity: str = "mild"
    mood: Optional[str] = None
    log_date: Optional[str] = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_store() -> dict[str, Any]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    seeded = {
        "profiles": {
            "1": {
                "id": 1,
                "name": "Demo Patient",
                "email": "demo@healthcare.ai",
                "age": 32,
                "gender": "Female",
                "blood_group": "O+",
                "allergies": ["Penicillin"],
                "chronic_conditions": ["Seasonal allergies"],
                "medications": ["Cetirizine"],
                "emergency_contact": "Jamie Doe, +1-555-0101",
                "preferred_doctors": ["General Physician", "Pulmonologist"],
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
        },
        "health_logs": [
            {
                "id": 1,
                "user_id": 1,
                "symptoms": ["fatigue", "headache"],
                "notes": "Long work week and poor sleep.",
                "severity": "mild",
                "mood": "tired",
                "log_date": "2025-02-20",
                "created_at": now_iso(),
            }
        ],
        "next_log_id": 2,
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


def get_current_user(authorization: str = Header(...)) -> dict[str, Any]:
    try:
        token = authorization.replace("Bearer ", "")
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def get_local_profile(user_id: str, user: dict[str, Any]) -> dict[str, Any]:
    store = ensure_store()
    profile = store["profiles"].get(user_id)
    if not profile:
        profile = {
            "id": int(user_id),
            "name": user.get("name", "Patient"),
            "email": user.get("email"),
            "age": None,
            "gender": None,
            "blood_group": None,
            "allergies": [],
            "chronic_conditions": [],
            "medications": [],
            "emergency_contact": None,
            "preferred_doctors": ["General Physician"],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        store["profiles"][user_id] = profile
        save_store(store)
    return profile


@app.get("/patient/profile")
def get_profile(user: dict[str, Any] = Depends(get_current_user)):
    user_id = str(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, name, email, age, gender, blood_group, allergies, chronic_conditions,
                   medications, emergency_contact, preferred_doctors, created_at, updated_at
            FROM users WHERE id = %s
            """,
            (user_id,),
        )
        profile = cursor.fetchone()
        db.close()
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        return profile
    return get_local_profile(user_id, user)


@app.put("/patient/profile")
def update_profile(payload: ProfileUpdate, user: dict[str, Any] = Depends(get_current_user)):
    user_id = str(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor()
        fields = {key: value for key, value in payload.model_dump().items() if value is not None}
        if not fields:
            return {"message": "Nothing to update"}
        columns = ", ".join(f"{key} = %s" for key in fields)
        cursor.execute(
            f"UPDATE users SET {columns}, updated_at = NOW() WHERE id = %s",
            (*fields.values(), user_id),
        )
        db.commit()
        db.close()
        return {"message": "Profile updated"}

    store = ensure_store()
    profile = get_local_profile(user_id, user)
    for key, value in payload.model_dump().items():
        if value is not None:
            profile[key] = value
    profile["updated_at"] = now_iso()
    store["profiles"][user_id] = profile
    save_store(store)
    return {"message": "Profile updated", "profile": profile}


@app.post("/patient/health-log")
def add_health_log(payload: HealthLog, user: dict[str, Any] = Depends(get_current_user)):
    user_id = str(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO health_logs (user_id, symptoms, notes, severity, mood, log_date, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                user_id,
                json.dumps(payload.symptoms),
                payload.notes,
                payload.severity,
                payload.mood,
                payload.log_date,
            ),
        )
        db.commit()
        log_id = cursor.lastrowid
        db.close()
        return {"id": log_id, "message": "Health log added"}

    store = ensure_store()
    log = {
        "id": store["next_log_id"],
        "user_id": int(user_id),
        "symptoms": payload.symptoms,
        "notes": payload.notes,
        "severity": payload.severity,
        "mood": payload.mood,
        "log_date": payload.log_date or datetime.now().date().isoformat(),
        "created_at": now_iso(),
    }
    store["next_log_id"] += 1
    store["health_logs"].append(log)
    save_store(store)
    return {"id": log["id"], "message": "Health log added", "log": log}


@app.get("/patient/health-logs")
def get_health_logs(user: dict[str, Any] = Depends(get_current_user)):
    user_id = int(user["sub"])
    if prefer_mysql():
        db = mysql_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, user_id, symptoms, notes, severity, mood, log_date, created_at
            FROM health_logs WHERE user_id = %s ORDER BY created_at DESC LIMIT 50
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        db.close()
        for row in rows:
            if isinstance(row["symptoms"], str):
                row["symptoms"] = json.loads(row["symptoms"])
        return rows

    logs = [log for log in ensure_store()["health_logs"] if log["user_id"] == user_id]
    return sorted(logs, key=lambda item: item["created_at"], reverse=True)


@app.get("/patient/timeline")
def get_timeline(user: dict[str, Any] = Depends(get_current_user)):
    logs = get_health_logs(user)
    summary: dict[str, int] = {}
    for log in logs:
        for symptom in log["symptoms"]:
            summary[symptom] = summary.get(symptom, 0) + 1
    return {"events": logs, "symptom_frequency": summary}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "patient",
        "storage_mode": "mysql" if prefer_mysql() else "local-json",
    }
