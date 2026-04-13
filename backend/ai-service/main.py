from __future__ import annotations

import os
from typing import Any, Optional

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents import (
    ConsultationPrepAgent,
    DoctorRecommendationAgent,
    ExplainabilityAgent,
    FollowUpQuestionAgent,
    RecommendationAgent,
    ReportGeneratorAgent,
    RiskAssessmentAgent,
    RiskDecisionAgent,
    SymptomExtractionAgent,
)
from llm import _call_llm, _normalize_json, build_prompt, call_gemini_or_openai

load_dotenv()

app = FastAPI(title="Healthcare AI Orchestrator", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SECRET_KEY = os.getenv("JWT_SECRET", "healthcare-secret-key-2024")
VECTOR_SERVICE_URL = os.getenv("VECTOR_SERVICE_URL", "http://localhost:8004")

symptom_agent = SymptomExtractionAgent()
risk_agent = RiskAssessmentAgent()
recommendation_agent = RecommendationAgent()
follow_up_agent = FollowUpQuestionAgent()
explainability_agent = ExplainabilityAgent()
doctor_agent = DoctorRecommendationAgent()
report_agent = ReportGeneratorAgent()
risk_decision_agent = RiskDecisionAgent()
consultation_prep_agent = ConsultationPrepAgent()


# ── Request models ──────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    patient_info: Optional[dict[str, Any]] = None

class ResearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=1000)

class DoctorRequest(BaseModel):
    symptoms: list[str]
    risk_level: str = "LOW"
    patient_info: Optional[dict[str, Any]] = None

class ReportRequest(BaseModel):
    chat_id: Optional[int] = None
    symptoms: list[str]
    risk_level: str = "LOW"
    patient_info: Optional[dict[str, Any]] = None
    llm_analysis: Optional[dict[str, Any]] = None

class RiskAnalysisRequest(BaseModel):
    symptoms: list[str]
    patient_info: Optional[dict[str, Any]] = None
    history_scores: Optional[list[int]] = None

class ChatTurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict[str, Any]] = []
    patient_info: Optional[dict[str, Any]] = None


# ── Helpers ─────────────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(...)) -> dict[str, Any]:
    try:
        token = authorization.replace("Bearer ", "")
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def retrieve_context(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{VECTOR_SERVICE_URL}/vector/query",
                json={"query": query, "top_k": top_k},
            )
            response.raise_for_status()
            return response.json().get("matches", [])
    except Exception:
        return []


def build_chat_prompt(
    message: str,
    history: list[dict[str, Any]],
    patient_info: Optional[dict[str, Any]],
    context_docs: list[dict[str, Any]],
) -> str:
    patient_info = patient_info or {}
    history_text = ""
    for turn in history[-6:]:
        role = "Patient" if turn["role"] == "user" else "HealthPilot AI"
        history_text += f"{role}: {turn['content']}\n"

    context_text = "\n".join(
        f"  [{i+1}] ({doc.get('category','general')}) {doc.get('text','')[:200]}"
        for i, doc in enumerate(context_docs[:3])
    ) or "  No retrieved context."

    return f"""You are HealthPilot, an advanced AI health assistant having a conversation with a patient.

PATIENT PROFILE:
  Age: {patient_info.get('age', 'unknown')} | Gender: {patient_info.get('gender', 'unknown')}
  Chronic conditions: {', '.join(patient_info.get('chronic_conditions') or []) or 'None'}
  Allergies: {', '.join(patient_info.get('allergies') or []) or 'None'}
  Medications: {', '.join(patient_info.get('medications') or []) or 'None'}

CONVERSATION HISTORY:
{history_text or 'No previous messages.'}

CURRENT MESSAGE: {message}

RELEVANT MEDICAL CONTEXT:
{context_text}

INSTRUCTIONS:
- Detect intent: symptom_report | follow_up | general_question | emergency | greeting | other
- If symptoms reported: give precise, specific clinical assessment addressing each symptom
- If follow_up: reference previous conversation context naturally
- If emergency keywords (chest pain, can't breathe, unconscious, stroke): set emergency=true immediately
- Be conversational but clinically precise. Use plain language the patient understands.
- Do NOT be generic. Be specific to the patient's symptoms, age, gender, and conditions.

Return ONLY valid JSON:
{{
  "intent": "symptom_report|follow_up|general_question|emergency|greeting|other",
  "reply": "conversational, precise response to the patient",
  "emergency": false,
  "risk_level": "HIGH|MEDIUM|LOW|NONE",
  "risk_score": 0,
  "conditions": [{{"name": "condition", "likelihood": "high|medium|low"}}],
  "symptoms_detected": ["symptom1", "symptom2"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2"],
  "suggested_tests": ["test 1"],
  "specialist": "specialist type or null",
  "follow_up_questions": ["targeted question 1", "targeted question 2"],
  "quick_replies": ["Tell me more", "What tests do I need?", "Find a doctor"],
  "care_plan": ["immediate step 1", "short-term step 2"]
}}""".strip()


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/ai/analyze")
async def analyze_symptoms(request: AnalyzeRequest, _: dict[str, Any] = Depends(get_current_user)):
    extracted = symptom_agent.extract(request.text)
    context_docs = await retrieve_context(request.text, top_k=5)
    prompt = build_prompt(extracted["symptoms"], context_docs, request.patient_info,
                          extracted["duration"], extracted["severity"])
    llm_result = call_gemini_or_openai(prompt, extracted["symptoms"], context_docs, request.patient_info)
    risk = risk_agent.assess(extracted["symptoms"], llm_result.get("assessment", ""), request.patient_info)
    recommendations = recommendation_agent.recommend(extracted["symptoms"], risk["level"])
    follow_up_questions = llm_result.get("follow_up_questions") or follow_up_agent.build_questions(extracted["symptoms"])
    explainability = explainability_agent.summarize(extracted["symptoms"], context_docs)
    doctors = doctor_agent.recommend(extracted["symptoms"], risk["level"], request.patient_info)
    risk_graph = risk_decision_agent.build_graph(extracted["symptoms"], risk, llm_result)
    report = report_agent.generate(extracted["symptoms"], risk, recommendations, llm_result, request.patient_info, explainability)

    return {
        "extracted_symptoms": extracted,
        "retrieval": {"context_count": len(context_docs), "documents": context_docs},
        "llm_analysis": llm_result | {"follow_up_questions": follow_up_questions},
        "risk_assessment": risk,
        "recommendations": recommendations,
        "doctor_recommendations": doctors,
        "risk_graph": risk_graph,
        "report": report,
        "advanced_features": {
            "doctor_recommendation_system": doctors,
            "test_suggestion_engine": recommendations["tests"],
            "smart_follow_up_questions": follow_up_questions,
            "emergency_alert": risk["level"] == "HIGH",
            "consultation_summary": {
                "symptoms": extracted["symptoms"],
                "top_risk": risk["level"],
                "next_steps": recommendations["precautions"][:2],
            },
            "confidence_score": llm_result.get("confidence_score", risk["confidence"]),
            "explainability": explainability,
        },
        "agent_pipeline": [
            "SymptomExtractionAgent", "RAGRetrievalAgent", "LLMDiagnosisAgent",
            "RiskAssessmentAgent", "RecommendationAgent", "DoctorRecommendationAgent",
            "RiskDecisionAgent", "ReportGeneratorAgent",
        ],
    }


@app.post("/ai/chat")
async def chat_turn(request: ChatTurnRequest, _: dict[str, Any] = Depends(get_current_user)):
    context_docs = await retrieve_context(request.message, top_k=3)
    prompt = build_chat_prompt(request.message, request.history, request.patient_info, context_docs)
    raw = _call_llm(prompt)

    fallback = {
        "intent": "other",
        "reply": "I'm having trouble connecting right now. Please try again in a moment.",
        "emergency": False, "risk_level": "NONE", "risk_score": 0,
        "conditions": [], "symptoms_detected": [], "recommendations": [],
        "suggested_tests": [], "specialist": None, "follow_up_questions": [],
        "quick_replies": ["Try again", "Describe symptoms"], "care_plan": [],
    }

    if raw is None:
        return fallback

    try:
        return _normalize_json(raw)
    except Exception:
        fallback["reply"] = raw[:500] if raw else fallback["reply"]
        return fallback


@app.post("/ai/research")
async def research_topic(request: ResearchRequest):
    context_docs = await retrieve_context(request.query, top_k=5)

    # Build a dedicated research prompt
    context_text = "\n".join(
        f"  [{i+1}] ({doc.get('category','general')}) {doc.get('text','')[:300]}"
        for i, doc in enumerate(context_docs[:5])
    ) or "  No retrieved context available."

    research_prompt = f"""You are a senior medical research assistant. Provide a comprehensive, evidence-based summary of the following medical topic for a patient audience.

TOPIC: {request.query}

RETRIEVED MEDICAL CONTEXT:
{context_text}

INSTRUCTIONS:
- Write in clear, professional language that a patient can understand
- Be thorough but concise — cover all key aspects
- Use evidence-based information only
- Clearly distinguish between established facts and areas of uncertainty
- Include practical, actionable information

Return ONLY valid JSON:
{{
  "topic": "Formal medical topic name",
  "overview": "2-3 sentence professional overview of the topic",
  "key_facts": [
    "Important fact 1 with clinical context",
    "Important fact 2",
    "Important fact 3",
    "Important fact 4"
  ],
  "symptoms_or_features": ["feature 1", "feature 2", "feature 3"],
  "causes_and_risk_factors": ["cause/risk 1", "cause/risk 2", "cause/risk 3"],
  "diagnosis": "How this condition is typically diagnosed",
  "treatment_options": [
    {{"type": "First-line", "description": "Primary treatment approach"}},
    {{"type": "Alternative", "description": "Alternative or adjunct treatment"}},
    {{"type": "Lifestyle", "description": "Lifestyle modifications"}}
  ],
  "prevention": ["Prevention strategy 1", "Prevention strategy 2"],
  "when_to_see_doctor": ["Warning sign 1", "Warning sign 2", "Warning sign 3"],
  "lifestyle_advice": ["Specific advice 1", "Specific advice 2", "Specific advice 3"],
  "related_conditions": ["Related condition 1", "Related condition 2"],
  "summary": "Comprehensive 3-4 sentence summary suitable for a patient",
  "confidence_score": 0.0,
  "disclaimer": "This information is for educational purposes only and does not constitute medical advice."
}}""".strip()

    raw = _call_llm(research_prompt)
    if raw is None:
        return {
            "query": request.query,
            "topic": request.query,
            "overview": "Research assistant temporarily unavailable. Please try again.",
            "key_facts": [],
            "symptoms_or_features": [],
            "causes_and_risk_factors": [],
            "diagnosis": "",
            "treatment_options": [],
            "prevention": [],
            "when_to_see_doctor": [],
            "lifestyle_advice": [],
            "related_conditions": [],
            "summary": "",
            "sources_used": len(context_docs),
            "rag_documents": context_docs[:3],
            "confidence_score": 0.0,
        }

    try:
        from llm import _normalize_json
        result = _normalize_json(raw)
    except Exception:
        result = {"summary": raw[:800], "overview": raw[:400]}

    result["query"] = request.query
    result["sources_used"] = len(context_docs)
    result["rag_documents"] = context_docs[:3]
    if "confidence_score" not in result:
        result["confidence_score"] = 0.75
    return result


@app.post("/ai/consultation-prep")
async def consultation_prep(request: AnalyzeRequest):
    extracted = symptom_agent.extract(request.text)
    prep = consultation_prep_agent.prepare(extracted["symptoms"], request.patient_info)
    recommendations = recommendation_agent.recommend(extracted["symptoms"], "MEDIUM")
    return {
        "symptoms": extracted["symptoms"],
        "severity": extracted["severity"],
        "duration": extracted["duration"],
        "consultation_guide": prep,
        "suggested_specialists": recommendations["doctors"],
        "suggested_tests": recommendations["tests"],
    }


@app.post("/ai/doctors")
async def get_doctor_recommendations(request: DoctorRequest, _: dict[str, Any] = Depends(get_current_user)):
    doctors = doctor_agent.recommend(request.symptoms, request.risk_level, request.patient_info)
    return {"doctors": doctors, "total": len(doctors)}


@app.post("/ai/report")
async def generate_report(request: ReportRequest, _: dict[str, Any] = Depends(get_current_user)):
    risk = risk_agent.assess(request.symptoms, "", request.patient_info)
    recommendations = recommendation_agent.recommend(request.symptoms, request.risk_level)
    explainability = explainability_agent.summarize(request.symptoms, [])
    llm_analysis = request.llm_analysis or {
        "assessment": f"Assessment based on reported symptoms: {', '.join(request.symptoms)}",
        "possible_conditions": [],
        "explanation": "",
        "follow_up_questions": follow_up_agent.build_questions(request.symptoms),
    }
    return report_agent.generate(request.symptoms, risk, recommendations, llm_analysis, request.patient_info, explainability)


@app.post("/ai/risk-analysis")
async def full_risk_analysis(request: RiskAnalysisRequest, _: dict[str, Any] = Depends(get_current_user)):
    risk = risk_agent.assess(request.symptoms, "", request.patient_info)
    recommendations = recommendation_agent.recommend(request.symptoms, risk["level"])
    explainability = explainability_agent.summarize(request.symptoms, [])
    history = request.history_scores or []

    trend = "stable"
    if len(history) >= 2:
        recent_avg = sum(history[-3:]) / len(history[-3:])
        older_avg = sum(history[:-3]) / max(len(history[:-3]), 1) if len(history) > 3 else history[0]
        if recent_avg > older_avg + 10: trend = "worsening"
        elif recent_avg < older_avg - 10: trend = "improving"

    patient_info = request.patient_info or {}
    what_if = []
    if patient_info.get("age"):
        y = {**patient_info, "age": max(0, patient_info["age"] - 20)}
        yr = risk_agent.assess(request.symptoms, "", y)
        what_if.append({"scenario": f"If patient were {y['age']} years old", "risk_score": yr["risk_score"], "level": yr["level"], "delta": yr["risk_score"] - risk["risk_score"]})
    if patient_info.get("chronic_conditions"):
        nc = {**patient_info, "chronic_conditions": []}
        ncr = risk_agent.assess(request.symptoms, "", nc)
        what_if.append({"scenario": "Without chronic conditions", "risk_score": ncr["risk_score"], "level": ncr["level"], "delta": ncr["risk_score"] - risk["risk_score"]})
    if len(request.symptoms) > 2:
        fr = risk_agent.assess(request.symptoms[:2], "", patient_info)
        what_if.append({"scenario": f"With only {', '.join(request.symptoms[:2])}", "risk_score": fr["risk_score"], "level": fr["level"], "delta": fr["risk_score"] - risk["risk_score"]})

    return {
        "risk": risk,
        "trend": trend,
        "trend_data": history,
        "what_if_simulations": what_if,
        "recommendations": recommendations,
        "explainability": explainability,
        "risk_factors_ranked": sorted([
            {"factor": "Emergency symptoms", "weight": len(risk["factors"]["emergency_symptoms"]) * 35, "present": bool(risk["factors"]["emergency_symptoms"])},
            {"factor": "Dangerous combinations", "weight": sum(c["boost"] for c in risk["factors"]["dangerous_combinations"]), "present": bool(risk["factors"]["dangerous_combinations"])},
            {"factor": "Age risk", "weight": risk["factors"]["age_boost"], "present": risk["factors"]["age_boost"] > 0},
            {"factor": "Chronic conditions", "weight": risk["factors"]["chronic_boost"], "present": risk["factors"]["chronic_conditions"] > 0},
            {"factor": "Symptom count", "weight": risk["score_breakdown"]["symptom_base"], "present": True},
            {"factor": "Elevated symptoms", "weight": 15 if risk["factors"]["elevated_symptoms"] else 0, "present": bool(risk["factors"]["elevated_symptoms"])},
        ], key=lambda x: x["weight"], reverse=True),
    }


@app.get("/ai/alerts")
async def get_alerts(authorization: str = Header(...)):
    return {
        "alert_rules": [
            {"level": "HIGH", "color": "#ef4444", "message": "Seek emergency care immediately", "icon": "🚨"},
            {"level": "MEDIUM", "color": "#f59e0b", "message": "Schedule a doctor visit within 24 hours", "icon": "⚠️"},
            {"level": "LOW", "color": "#22c55e", "message": "Monitor symptoms and rest", "icon": "✅"},
        ],
        "emergency_numbers": {"emergency": "911", "poison_control": "1-800-222-1222", "mental_health_crisis": "988"},
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-orchestrator", "version": "3.0.0"}
