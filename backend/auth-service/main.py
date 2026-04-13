import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import bcrypt
import jwt
import mysql.connector
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

app = FastAPI(
    title="Healthcare Auth Service",
    version="2.0.0",
    description="JWT authentication and user identity service.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()
DATA_FILE = Path(__file__).with_name("auth_data.json")
SECRET_KEY = os.getenv("JWT_SECRET", "healthcare-secret-key-2024")
ALGORITHM = "HS256"
TOKEN_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))
USE_LOCAL_STORE = os.getenv("USE_LOCAL_STORE", "true").lower() == "true"
MYSQL_ENABLED = os.getenv("MYSQL_ENABLED", "false").lower() == "true"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    age: Optional[int] = Field(default=None, ge=0, le=120)
    gender: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_store() -> dict[str, Any]:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    seeded = {
        "users": [
            {
                "id": 1,
                "name": "Demo Patient",
                "email": "demo@healthcare.ai",
                "password_hash": bcrypt.hashpw("DemoPass123!".encode(), bcrypt.gensalt()).decode(),
                "age": 32,
                "gender": "Female",
                "created_at": now_iso(),
            }
        ],
        "next_user_id": 2,
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


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict[str, Any]:
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def find_local_user_by_email(email: str) -> Optional[dict[str, Any]]:
    store = ensure_store()
    return next((user for user in store["users"] if user["email"].lower() == email.lower()), None)


def register_local_user(payload: RegisterRequest) -> dict[str, Any]:
    store = ensure_store()
    if find_local_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = {
        "id": store["next_user_id"],
        "name": payload.name,
        "email": payload.email,
        "password_hash": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
        "age": payload.age,
        "gender": payload.gender,
        "created_at": now_iso(),
    }
    store["next_user_id"] += 1
    store["users"].append(user)
    save_store(store)
    return user


def login_local_user(payload: LoginRequest) -> dict[str, Any]:
    user = find_local_user_by_email(payload.email)
    if not user or not bcrypt.checkpw(payload.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


def sanitize_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(user["id"]),
        "name": user["name"],
        "email": user["email"],
        "age": user.get("age"),
        "gender": user.get("gender"),
    }


def mysql_register_user(payload: RegisterRequest) -> dict[str, Any]:
    db = mysql_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE email = %s", (payload.email,))
    if cursor.fetchone():
        db.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    cursor.execute(
        """
        INSERT INTO users (name, email, password_hash, age, gender, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        """,
        (payload.name, payload.email, password_hash, payload.age, payload.gender),
    )
    db.commit()
    user_id = cursor.lastrowid
    cursor.execute(
        "SELECT id, name, email, age, gender FROM users WHERE id = %s",
        (user_id,),
    )
    user = cursor.fetchone()
    db.close()
    return user


def mysql_login_user(payload: LoginRequest) -> dict[str, Any]:
    db = mysql_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (payload.email,))
    user = cursor.fetchone()
    db.close()
    if not user or not bcrypt.checkpw(payload.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


def prefer_mysql() -> bool:
    return MYSQL_ENABLED and not USE_LOCAL_STORE


@app.post("/auth/register")
def register(request: RegisterRequest):
    user = mysql_register_user(request) if prefer_mysql() else register_local_user(request)
    user_summary = sanitize_user(user)
    return {
        "token": create_token(user_summary),
        "user": user_summary,
        "storage_mode": "mysql" if prefer_mysql() else "local-json",
    }


@app.post("/auth/login")
def login(request: LoginRequest):
    user = mysql_login_user(request) if prefer_mysql() else login_local_user(request)
    user_summary = sanitize_user(user)
    return {
        "token": create_token(user_summary),
        "user": user_summary,
        "storage_mode": "mysql" if prefer_mysql() else "local-json",
    }


@app.get("/auth/verify")
def verify(payload: dict[str, Any] = Depends(verify_token)):
    return payload


@app.get("/auth/demo-user")
def demo_user():
    user = sanitize_user(ensure_store()["users"][0])
    return {
        "email": user["email"],
        "password_hint": "DemoPass123!",
        "user": user,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "auth",
        "storage_mode": "mysql" if prefer_mysql() else "local-json",
        "signature": hmac.new(SECRET_KEY.encode(), b"healthcare", hashlib.sha256).hexdigest()[:12],
    }
