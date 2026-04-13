from __future__ import annotations

import math
import os
from collections import Counter
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from pinecone import Pinecone, ServerlessSpec
except Exception:
    Pinecone = None
    ServerlessSpec = None

try:
    from google import genai as google_genai
except Exception:
    google_genai = None

load_dotenv()

app = FastAPI(title="Healthcare Vector Service", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "healthcare-knowledge")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
USE_PINECONE = os.getenv("USE_PINECONE", "false").lower() == "true"
pc = None
index = None

MEDICAL_KNOWLEDGE = [
    # Infectious
    {"id": "flu_001", "text": "Influenza commonly causes fever, chills, cough, body aches, headache, and fatigue. Supportive care includes rest, fluids, and symptom monitoring. High-risk patients may need antiviral treatment.", "category": "infectious"},
    {"id": "covid_001", "text": "COVID-19 may present with fever, dry cough, fatigue, sore throat, loss of smell, and shortness of breath. Emergency symptoms include chest pain, severe breathing trouble, and confusion.", "category": "infectious"},
    {"id": "strep_001", "text": "Streptococcal pharyngitis presents with severe sore throat, fever, swollen lymph nodes, and absence of cough. Rapid strep test and antibiotic treatment are standard.", "category": "infectious"},
    {"id": "uti_001", "text": "Urinary tract infections often cause burning urination, frequent urination, and pelvic discomfort. Fever or flank pain can indicate a more serious infection needing prompt care.", "category": "urology"},
    {"id": "pneumonia_001", "text": "Pneumonia presents with productive cough, fever, chills, and shortness of breath. Chest X-ray confirms diagnosis. Treatment depends on bacterial vs viral etiology.", "category": "respiratory"},
    # Cardiovascular
    {"id": "chest_pain_001", "text": "Chest pain requires careful triage because causes include cardiac ischemia, pulmonary embolism, reflux, and musculoskeletal pain. Emergency care is appropriate for severe or persistent chest pain with shortness of breath.", "category": "emergency"},
    {"id": "heart_failure_001", "text": "Heart failure symptoms include shortness of breath, ankle swelling, fatigue, and reduced exercise tolerance. BNP levels and echocardiography are key diagnostic tools.", "category": "cardiology"},
    {"id": "hypertension_001", "text": "Hypertension is often asymptomatic but can cause headaches, dizziness, and visual changes at very high levels. Regular monitoring and lifestyle modification are first-line management.", "category": "cardiology"},
    {"id": "palpitations_001", "text": "Palpitations can be caused by arrhythmias, anxiety, caffeine, thyroid disease, or anemia. ECG and Holter monitoring help identify the underlying cause.", "category": "cardiology"},
    # Respiratory
    {"id": "asthma_001", "text": "Asthma symptoms include wheezing, chest tightness, cough, and shortness of breath. Acute worsening may require bronchodilator treatment and urgent evaluation.", "category": "respiratory"},
    {"id": "copd_001", "text": "COPD presents with chronic productive cough, progressive dyspnea, and reduced exercise tolerance. Spirometry confirms diagnosis. Smoking cessation is the most effective intervention.", "category": "respiratory"},
    {"id": "allergic_rhinitis_001", "text": "Allergic rhinitis causes runny nose, sneezing, nasal congestion, and itchy eyes. Antihistamines and nasal corticosteroids are first-line treatments.", "category": "allergy"},
    # Neurological
    {"id": "migraine_001", "text": "Migraine symptoms can include throbbing headache, nausea, vomiting, and sensitivity to light or sound. Red flags include sudden thunderclap headache or neurological deficits.", "category": "neurology"},
    {"id": "tension_headache_001", "text": "Tension headaches present as bilateral pressure or tightness, mild to moderate severity, not worsened by activity. NSAIDs and stress management are effective treatments.", "category": "neurology"},
    {"id": "vertigo_001", "text": "Vertigo causes a sensation of spinning or movement. BPPV is the most common cause. Epley maneuver is effective for BPPV. Central causes require urgent evaluation.", "category": "neurology"},
    {"id": "anxiety_001", "text": "Anxiety can cause palpitations, dizziness, chest tightness, sweating, insomnia, and restlessness. Clinicians should rule out cardiopulmonary causes when symptoms overlap.", "category": "mental-health"},
    # Gastrointestinal
    {"id": "gerd_001", "text": "GERD presents with heartburn, regurgitation, and chest discomfort. Lifestyle modifications and proton pump inhibitors are first-line treatments.", "category": "gastroenterology"},
    {"id": "ibs_001", "text": "Irritable bowel syndrome causes abdominal pain, bloating, and altered bowel habits. Diagnosis is clinical. Dietary changes and stress management are key.", "category": "gastroenterology"},
    {"id": "appendicitis_001", "text": "Appendicitis presents with periumbilical pain migrating to the right lower quadrant, fever, nausea, and vomiting. Urgent surgical evaluation is required.", "category": "emergency"},
    # Chronic conditions
    {"id": "diabetes_001", "text": "Symptoms of uncontrolled diabetes may include fatigue, frequent urination, increased thirst, blurred vision, and slow wound healing. Assessment often includes HbA1c and glucose testing.", "category": "chronic"},
    {"id": "hypothyroid_001", "text": "Hypothyroidism causes fatigue, weight gain, cold intolerance, constipation, dry skin, and depression. TSH is the primary screening test. Levothyroxine is standard treatment.", "category": "endocrinology"},
    {"id": "anemia_001", "text": "Anemia presents with fatigue, pallor, shortness of breath on exertion, and palpitations. CBC with differential and iron studies guide diagnosis and treatment.", "category": "hematology"},
    {"id": "rheumatoid_001", "text": "Rheumatoid arthritis causes symmetric joint pain, morning stiffness, swelling, and fatigue. Rheumatoid factor and anti-CCP antibodies support diagnosis. DMARDs are first-line treatment.", "category": "rheumatology"},
    # Dermatology
    {"id": "eczema_001", "text": "Eczema presents with itchy, inflamed, and dry skin patches. Triggers include allergens, stress, and irritants. Moisturizers and topical corticosteroids are mainstays of treatment.", "category": "dermatology"},
    {"id": "psoriasis_001", "text": "Psoriasis causes red, scaly plaques on skin, often on elbows, knees, and scalp. It is an autoimmune condition. Topical treatments, phototherapy, and biologics are used.", "category": "dermatology"},
    # Mental health
    {"id": "depression_001", "text": "Depression presents with persistent low mood, loss of interest, fatigue, sleep changes, and cognitive difficulties. PHQ-9 is a validated screening tool. SSRIs and therapy are first-line.", "category": "mental-health"},
    {"id": "insomnia_001", "text": "Insomnia involves difficulty falling or staying asleep. Cognitive behavioral therapy for insomnia (CBT-I) is the most effective long-term treatment. Sleep hygiene is foundational.", "category": "mental-health"},
    # Emergency
    {"id": "stroke_001", "text": "Stroke presents with sudden facial drooping, arm weakness, speech difficulty, and severe headache. FAST acronym guides recognition. Time-critical treatment with tPA within 4.5 hours.", "category": "emergency"},
    {"id": "sepsis_001", "text": "Sepsis presents with fever or hypothermia, tachycardia, tachypnea, and altered mental status in the context of infection. Early antibiotics and fluid resuscitation are critical.", "category": "emergency"},
]


class QueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=10)
    category_filter: Optional[str] = None


class UpsertRequest(BaseModel):
    documents: Optional[list[dict[str, Any]]] = None


def tokenize(text: str) -> Counter[str]:
    tokens = [token.strip(".,!?():;").lower() for token in text.split()]
    return Counter(token for token in tokens if token)


def cosine_similarity(left: Counter[str], right: Counter[str]) -> float:
    intersection = set(left) & set(right)
    numerator = sum(left[token] * right[token] for token in intersection)
    left_norm = math.sqrt(sum(v * v for v in left.values()))
    right_norm = math.sqrt(sum(v * v for v in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def get_pinecone_index():
    global pc, index
    if not USE_PINECONE or not PINECONE_API_KEY or Pinecone is None:
        return None
    if index is None:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        existing = [item.name for item in pc.list_indexes()]
        if PINECONE_INDEX not in existing:
            pc.create_index(
                name=PINECONE_INDEX,
                dimension=768,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        index = pc.Index(PINECONE_INDEX)
    return index


def get_embedding(text: str) -> list[float]:
    if google_genai is None or not GEMINI_API_KEY:
        return []
    client = google_genai.Client(api_key=GEMINI_API_KEY)
    result = client.models.embed_content(
        model="models/text-embedding-004",
        contents=text,
    )
    return result.embeddings[0].values


def local_query(query: str, top_k: int, category_filter: Optional[str]) -> list[dict[str, Any]]:
    query_vector = tokenize(query)
    candidates = []
    for document in MEDICAL_KNOWLEDGE:
        if category_filter and document["category"] != category_filter:
            continue
        score = cosine_similarity(query_vector, tokenize(document["text"]))
        candidates.append({
            "id": document["id"],
            "score": round(score, 4),
            "text": document["text"],
            "category": document["category"],
        })
    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:top_k]


@app.post("/vector/upsert")
def upsert_knowledge(request: Optional[UpsertRequest] = None):
    documents = request.documents if request and request.documents else MEDICAL_KNOWLEDGE
    target_index = get_pinecone_index()
    if target_index is None or not GEMINI_API_KEY:
        return {"message": f"Local knowledge base ready with {len(MEDICAL_KNOWLEDGE)} documents", "mode": "local"}

    vectors = []
    for document in documents:
        embedding = get_embedding(document["text"])
        if embedding:
            vectors.append({
                "id": document["id"],
                "values": embedding,
                "metadata": {"text": document["text"], "category": document.get("category", "general")},
            })
    if vectors:
        target_index.upsert(vectors=vectors)
    return {"message": f"Upserted {len(vectors)} documents", "mode": "pinecone"}


@app.post("/vector/query")
def query_knowledge(request: QueryRequest):
    target_index = get_pinecone_index()
    if target_index is None or not GEMINI_API_KEY:
        return {"matches": local_query(request.query, request.top_k, request.category_filter), "mode": "local"}

    query_embedding = get_embedding(request.query)
    if not query_embedding:
        return {"matches": local_query(request.query, request.top_k, request.category_filter), "mode": "local-fallback"}

    filter_dict = {"category": request.category_filter} if request.category_filter else None
    results = target_index.query(vector=query_embedding, top_k=request.top_k, include_metadata=True, filter=filter_dict)
    matches = [
        {"id": m.id, "score": m.score, "text": m.metadata.get("text", ""), "category": m.metadata.get("category", "general")}
        for m in results.matches
    ]
    return {"matches": matches, "mode": "pinecone"}


@app.get("/vector/stats")
def get_stats():
    target_index = get_pinecone_index()
    if target_index is None:
        return {"total_vectors": len(MEDICAL_KNOWLEDGE), "index": "local-knowledge", "mode": "local"}
    stats = target_index.describe_index_stats()
    return {"total_vectors": stats.total_vector_count, "index": PINECONE_INDEX, "mode": "pinecone"}


@app.get("/vector/knowledge")
def list_knowledge():
    return {"documents": MEDICAL_KNOWLEDGE, "total": len(MEDICAL_KNOWLEDGE)}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "vector",
        "mode": "pinecone" if get_pinecone_index() is not None else "local",
        "knowledge_base_size": len(MEDICAL_KNOWLEDGE),
    }
