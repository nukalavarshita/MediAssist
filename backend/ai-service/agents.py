from __future__ import annotations

import re
from collections import Counter
from typing import Any, Optional


class SymptomExtractionAgent:
    symptom_keywords = {
        "fever": ["fever", "temperature", "chills"],
        "cough": ["cough", "coughing"],
        "headache": ["headache", "migraine"],
        "fatigue": ["fatigue", "tired", "exhausted"],
        "nausea": ["nausea", "queasy"],
        "vomiting": ["vomiting", "throwing up"],
        "dizziness": ["dizzy", "dizziness", "lightheaded"],
        "shortness of breath": ["shortness of breath", "difficulty breathing", "breathless"],
        "chest pain": ["chest pain", "tightness in chest", "heart pain"],
        "sore throat": ["sore throat"],
        "runny nose": ["runny nose", "congestion"],
        "body aches": ["body ache", "body aches", "muscle pain"],
        "rash": ["rash", "skin bumps"],
        "diarrhea": ["diarrhea", "loose stools"],
        "abdominal pain": ["abdominal pain", "stomach pain", "belly pain"],
        "frequent urination": ["frequent urination", "pee often"],
        "painful urination": ["painful urination", "burning urination"],
        "palpitations": ["palpitations", "racing heart"],
        "anxiety": ["anxiety", "panic"],
        "insomnia": ["insomnia", "can't sleep", "cannot sleep"],
        "loss of smell": ["loss of smell"],
        "loss of taste": ["loss of taste"],
        "back pain": ["back pain", "lower back"],
        "joint pain": ["joint pain", "arthritis"],
        "swelling": ["swelling", "edema"],
        "blurred vision": ["blurred vision", "vision loss", "vision changes"],
        "numbness": ["numbness", "tingling"],
        "weight loss": ["weight loss", "losing weight"],
        "night sweats": ["night sweats"],
    }

    def extract(self, text: str) -> dict[str, Any]:
        normalized_text = text.lower().strip()
        symptoms: list[str] = []
        for normalized, keywords in self.symptom_keywords.items():
            if any(keyword in normalized_text for keyword in keywords):
                symptoms.append(normalized)

        severity = "moderate"
        if any(token in normalized_text for token in ["severe", "extreme", "unbearable", "worst"]):
            severity = "severe"
        elif any(token in normalized_text for token in ["mild", "slight", "small", "minor"]):
            severity = "mild"

        duration_match = re.search(r"(\d+)\s*(hour|day|week|month)s?", normalized_text)
        duration = duration_match.group(0) if duration_match else "not specified"

        return {
            "symptoms": symptoms or [text.strip()],
            "raw_text": text,
            "duration": duration,
            "severity": severity,
            "symptom_count": len(symptoms) if symptoms else 1,
            "red_flags": [
                red_flag
                for red_flag in ["chest pain", "shortness of breath", "confusion", "vision loss", "numbness"]
                if red_flag in normalized_text
            ],
        }


class RiskAssessmentAgent:
    emergency_terms = {
        "chest pain", "shortness of breath", "stroke", "unconscious",
        "severe bleeding", "difficulty breathing", "confusion",
    }
    elevated_terms = {
        "palpitations", "high fever", "vision loss", "numbness",
        "persistent vomiting", "blurred vision", "night sweats",
    }
    # Symptom combination patterns that elevate risk
    dangerous_combos = [
        {"symptoms": {"chest pain", "shortness of breath"}, "boost": 20, "note": "Cardiac emergency pattern"},
        {"symptoms": {"chest pain", "sweating"}, "boost": 18, "note": "Possible MI pattern"},
        {"symptoms": {"headache", "confusion"}, "boost": 15, "note": "Neurological concern"},
        {"symptoms": {"fever", "shortness of breath", "cough"}, "boost": 12, "note": "Respiratory infection pattern"},
        {"symptoms": {"dizziness", "chest pain"}, "boost": 15, "note": "Cardiovascular concern"},
        {"symptoms": {"numbness", "blurred vision"}, "boost": 18, "note": "Possible stroke pattern"},
        {"symptoms": {"abdominal pain", "fever", "vomiting"}, "boost": 10, "note": "Acute abdomen pattern"},
        {"symptoms": {"fatigue", "weight loss", "night sweats"}, "boost": 14, "note": "Systemic illness pattern"},
    ]
    # Chronic conditions that amplify risk
    high_risk_conditions = {
        "diabetes", "heart disease", "hypertension", "copd", "asthma",
        "cancer", "kidney disease", "liver disease", "immunocompromised",
    }

    def assess(self, symptoms: list[str], llm_response: str = "", patient_info: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        patient_info = patient_info or {}
        combined = " ".join(symptoms).lower() + " " + llm_response.lower()
        symptom_set = set(s.lower() for s in symptoms)
        chronic = [c.lower() for c in (patient_info.get("chronic_conditions") or [])]
        chronic_count = len(chronic)
        age = patient_info.get("age") or 0
        allergies = patient_info.get("allergies") or []

        # ── Base score from symptom severity ──
        base_score = len(symptoms) * 6

        # ── Emergency term detection ──
        emergency_hits = [t for t in self.emergency_terms if t in combined]
        elevated_hits = [t for t in self.elevated_terms if t in combined]

        # ── Dangerous combination detection ──
        combo_boosts = []
        for combo in self.dangerous_combos:
            if combo["symptoms"].issubset(symptom_set):
                combo_boosts.append({"boost": combo["boost"], "note": combo["note"]})
                base_score += combo["boost"]

        # ── Patient risk factors ──
        age_boost = 0
        if age > 75: age_boost = 20
        elif age > 65: age_boost = 12
        elif age > 55: age_boost = 6
        elif age < 5: age_boost = 10
        base_score += age_boost

        chronic_boost = 0
        high_risk_chronic = [c for c in chronic if any(h in c for h in self.high_risk_conditions)]
        chronic_boost = min(len(chronic) * 5 + len(high_risk_chronic) * 5, 25)
        base_score += chronic_boost

        allergy_boost = min(len(allergies) * 2, 8)
        base_score += allergy_boost

        # ── Emergency/elevated boosts ──
        if emergency_hits:
            base_score += 30 + len(emergency_hits) * 5
        elif elevated_hits:
            base_score += 15 + len(elevated_hits) * 3

        risk_score = min(int(base_score), 100)

        # ── Level classification ──
        if emergency_hits or risk_score >= 75:
            level = "HIGH"
            urgency = "Immediate medical attention recommended — seek emergency care now"
            color = "#ef4444"
            confidence = 0.88 + min(len(emergency_hits) * 0.02, 0.1)
        elif elevated_hits or risk_score >= 45 or chronic_count >= 2 or age > 65:
            level = "MEDIUM"
            urgency = "Clinical review recommended within 24 hours"
            color = "#f59e0b"
            confidence = 0.78 + min(len(elevated_hits) * 0.02, 0.1)
        else:
            level = "LOW"
            urgency = "Self-care and monitoring are reasonable unless symptoms worsen"
            color = "#22c55e"
            confidence = 0.70

        # ── Prediction: what could happen if untreated ──
        prediction = self._predict_trajectory(level, symptoms, chronic, age)

        return {
            "level": level,
            "color": color,
            "urgency": urgency,
            "confidence": round(min(confidence, 0.97), 2),
            "risk_score": risk_score,
            "factors": {
                "symptom_count": len(symptoms),
                "emergency_symptoms": emergency_hits,
                "elevated_symptoms": elevated_hits,
                "dangerous_combinations": combo_boosts,
                "chronic_conditions": chronic_count,
                "high_risk_chronic": high_risk_chronic,
                "age": age,
                "age_boost": age_boost,
                "chronic_boost": chronic_boost,
                "allergy_count": len(allergies),
            },
            "score_breakdown": {
                "symptom_base": min(len(symptoms) * 6, 36),
                "emergency_boost": 30 + len(emergency_hits) * 5 if emergency_hits else 0,
                "elevated_boost": 15 + len(elevated_hits) * 3 if elevated_hits else 0,
                "combination_boost": sum(c["boost"] for c in combo_boosts),
                "age_boost": age_boost,
                "chronic_boost": chronic_boost,
            },
            "prediction": prediction,
            "red_flags": emergency_hits,
            "worsening_signs": [
                "Increasing severity or frequency of symptoms",
                "New symptoms developing alongside existing ones",
                "Symptoms not improving after 48 hours of self-care",
                "Fever above 39.5°C (103°F)",
            ],
        }

    def _predict_trajectory(self, level: str, symptoms: list[str], chronic: list[str], age: int) -> dict[str, Any]:
        if level == "HIGH":
            return {
                "short_term": "Without immediate care, condition may deteriorate rapidly within hours",
                "if_untreated": "Risk of serious complications or life-threatening outcomes",
                "recommended_action": "Call emergency services or go to ER immediately",
                "timeframe": "Act within the next 1 hour",
            }
        elif level == "MEDIUM":
            return {
                "short_term": "Symptoms likely to persist or worsen without medical evaluation",
                "if_untreated": "Possible progression to more serious condition within 24–72 hours",
                "recommended_action": "Schedule urgent GP or specialist appointment today",
                "timeframe": "Act within the next 24 hours",
            }
        else:
            return {
                "short_term": "Symptoms may resolve with rest and self-care over 3–7 days",
                "if_untreated": "Low risk of serious complications; monitor for worsening",
                "recommended_action": "Rest, hydrate, and monitor symptoms. See a doctor if no improvement in 5 days",
                "timeframe": "Monitor over the next 3–5 days",
            }


class RecommendationAgent:
    specialty_map = {
        "chest pain": "Cardiologist",
        "palpitations": "Cardiologist",
        "shortness of breath": "Pulmonologist",
        "cough": "Pulmonologist",
        "headache": "Neurologist",
        "dizziness": "Neurologist",
        "blurred vision": "Neurologist",
        "numbness": "Neurologist",
        "abdominal pain": "Gastroenterologist",
        "diarrhea": "Gastroenterologist",
        "rash": "Dermatologist",
        "anxiety": "Psychiatrist",
        "insomnia": "Psychiatrist",
        "painful urination": "Urologist",
        "frequent urination": "Urologist",
        "joint pain": "Rheumatologist",
        "back pain": "Orthopedist",
        "swelling": "General Physician",
        "weight loss": "Endocrinologist",
        "night sweats": "Hematologist",
    }
    test_map = {
        "fever": ["CBC", "CRP", "Blood culture"],
        "cough": ["Chest X-ray", "Pulse oximetry", "Sputum culture"],
        "shortness of breath": ["Spirometry", "Pulse oximetry", "Chest X-ray", "ABG"],
        "chest pain": ["ECG", "Troponin", "Chest X-ray", "Echo"],
        "fatigue": ["CBC", "TSH", "Vitamin D", "Iron studies"],
        "headache": ["Blood pressure check", "Neurological exam", "MRI Brain"],
        "painful urination": ["Urinalysis", "Urine culture"],
        "abdominal pain": ["CMP", "Ultrasound abdomen", "LFT"],
        "joint pain": ["ESR", "CRP", "Rheumatoid factor", "X-ray joints"],
        "weight loss": ["TSH", "HbA1c", "CBC", "CT scan"],
        "night sweats": ["CBC", "LDH", "ESR", "Chest X-ray"],
        "palpitations": ["ECG", "Holter monitor", "TSH", "Echo"],
    }

    def recommend(self, symptoms: list[str], risk_level: str) -> dict[str, Any]:
        doctors = list({self.specialty_map.get(symptom, "General Physician") for symptom in symptoms})[:3]
        tests: list[str] = []
        for symptom in symptoms:
            tests.extend(self.test_map.get(symptom, []))

        precautions = [
            "Hydrate well and rest.",
            "Track symptoms, temperature, and triggers.",
            "Avoid new over-the-counter medication combinations without clinician guidance.",
        ]
        if risk_level == "HIGH":
            precautions.insert(0, "Seek urgent or emergency medical attention now.")
        elif risk_level == "MEDIUM":
            precautions.insert(0, "Arrange a clinician review soon, ideally within 24 hours.")

        lifestyle = [
            "Maintain a consistent sleep schedule of 7–9 hours.",
            "Stay hydrated with at least 8 glasses of water daily.",
            "Avoid smoking and limit alcohol consumption.",
            "Engage in moderate physical activity 30 minutes daily.",
        ]

        return {
            "doctors": doctors or ["General Physician"],
            "tests": list(dict.fromkeys(tests))[:6] or ["Basic clinical assessment"],
            "precautions": precautions,
            "lifestyle": lifestyle,
            "follow_up": "Return for care immediately if breathing trouble, chest pain, confusion, or worsening symptoms develop.",
        }


class FollowUpQuestionAgent:
    # Questions the AI asks the PATIENT to better understand their symptoms
    question_bank = {
        "fever": "How high has your temperature been, and how many days have you had it?",
        "cough": "Is your cough bringing up any mucus, and does it feel worse at certain times of day?",
        "headache": "Where is the pain located, and does anything make it better or worse?",
        "abdominal pain": "Can you point to where the pain is worst, and does eating affect it?",
        "shortness of breath": "Does the breathlessness happen when you're resting, moving around, or both?",
        "chest pain": "Can you describe what the pain feels like — is it sharp, tight, or a dull ache?",
        "dizziness": "Does the room feel like it's spinning, or do you feel more like you might faint?",
        "rash": "When did the rash first appear, and has it spread or changed since then?",
        "fatigue": "How long have you been feeling this tired, and does sleep or rest help at all?",
        "palpitations": "How long do the episodes last, and do you notice anything that triggers them?",
        "nausea": "Is the nausea constant or does it come and go, and have you been able to keep food down?",
        "joint pain": "Which joints are affected, and is there any swelling, redness, or stiffness?",
        "back pain": "Does the pain stay in one place or does it travel down your leg?",
        "insomnia": "Is it hard to fall asleep, stay asleep, or both — and how long has this been going on?",
        "anxiety": "Are there specific situations that trigger your anxiety, or does it feel constant?",
    }

    def build_questions(self, symptoms: list[str]) -> list[str]:
        questions = [self.question_bank[symptom] for symptom in symptoms if symptom in self.question_bank]
        questions.append("Have you noticed any other new symptoms alongside these?")
        return questions[:5]


class ExplainabilityAgent:
    """Produces a detailed, transparent explanation of how the AI reached its assessment."""

    SYMPTOM_CLINICAL_WEIGHT = {
        "chest pain": 0.95, "shortness of breath": 0.92, "confusion": 0.90,
        "numbness": 0.85, "blurred vision": 0.85, "palpitations": 0.80,
        "fever": 0.70, "headache": 0.65, "fatigue": 0.55, "cough": 0.60,
        "nausea": 0.50, "dizziness": 0.65, "abdominal pain": 0.70,
        "rash": 0.55, "joint pain": 0.60, "back pain": 0.50,
        "night sweats": 0.72, "weight loss": 0.75, "vomiting": 0.60,
    }

    def summarize(self, symptoms: list[str], context_docs: list[dict[str, Any]]) -> dict[str, Any]:
        # ── Factor weights based on clinical significance ──
        factor_weights = {
            s: self.SYMPTOM_CLINICAL_WEIGHT.get(s, 0.50)
            for s in symptoms
        }
        sorted_factors = sorted(factor_weights.items(), key=lambda x: x[1], reverse=True)

        # ── Evidence quality from RAG ──
        rag_evidence = []
        for doc in context_docs[:5]:
            rag_evidence.append({
                "source_id": doc.get("id", "unknown"),
                "category": doc.get("category", "general"),
                "relevance_score": round(doc.get("score", 0.5), 3),
                "snippet": doc.get("text", "")[:120] + "…" if len(doc.get("text", "")) > 120 else doc.get("text", ""),
            })

        avg_rag_score = (
            sum(d.get("score", 0.5) for d in context_docs[:5]) / len(context_docs[:5])
            if context_docs else 0.0
        )

        # ── Agent reasoning trace ──
        reasoning_trace = [
            {
                "step": 1,
                "agent": "SymptomExtractionAgent",
                "action": f"Identified {len(symptoms)} symptom(s) from patient input using keyword matching and NLP",
                "output": symptoms,
                "confidence": 0.92,
            },
            {
                "step": 2,
                "agent": "RAGRetrievalAgent",
                "action": f"Retrieved {len(context_docs)} relevant medical knowledge documents via vector similarity search",
                "output": [d.get("category", "general") for d in context_docs[:3]],
                "confidence": round(avg_rag_score, 2),
            },
            {
                "step": 3,
                "agent": "LLMDiagnosisAgent",
                "action": "Generated clinical assessment using Gemini 2.0 Flash with patient profile and retrieved context",
                "output": "Structured JSON assessment with conditions, care plan, and follow-up questions",
                "confidence": 0.85,
            },
            {
                "step": 4,
                "agent": "RiskAssessmentAgent",
                "action": "Computed multi-factor risk score using symptom severity, patient demographics, and dangerous combinations",
                "output": "Risk level, score, and trajectory prediction",
                "confidence": 0.90,
            },
            {
                "step": 5,
                "agent": "RecommendationAgent",
                "action": "Mapped symptoms to specialist types, diagnostic tests, and evidence-based precautions",
                "output": "Personalised recommendations, tests, and lifestyle advice",
                "confidence": 0.88,
            },
            {
                "step": 6,
                "agent": "DoctorRecommendationAgent",
                "action": "Matched symptoms to specialist database, ranked by rating and experience",
                "output": "Top-ranked specialists with match reasoning",
                "confidence": 0.87,
            },
        ]

        # ── Limitations and caveats ──
        limitations = [
            "This assessment is based solely on self-reported symptoms and does not include physical examination findings.",
            "Laboratory results, imaging, and clinical history are not available to this system.",
            "AI-generated assessments carry inherent uncertainty and should not replace professional medical advice.",
            "Symptom overlap between conditions means multiple diagnoses may be plausible simultaneously.",
        ]
        if not context_docs:
            limitations.append("No external medical knowledge was retrieved — assessment relies entirely on LLM training data.")

        return {
            "key_factors": [s for s, _ in sorted_factors[:5]],
            "factor_weights": dict(sorted_factors),
            "rag_evidence": rag_evidence,
            "rag_quality_score": round(avg_rag_score, 3),
            "rag_documents_used": len(context_docs),
            "agent_reasoning_trace": reasoning_trace,
            "evidence_categories": list({d.get("category", "general") for d in context_docs[:5]}),
            "reasoning_note": (
                "This assessment was produced by a multi-agent AI pipeline combining symptom extraction, "
                "retrieval-augmented generation (RAG) from a curated medical knowledge base, "
                "large language model synthesis, and rule-based risk classification. "
                "It is intended as a decision support tool only and does NOT constitute a medical diagnosis."
            ),
            "limitations": limitations,
            "data_sources": [
                "Curated medical knowledge base (29 documents across 12 clinical categories)",
                "Gemini 2.0 Flash large language model",
                "Rule-based symptom-risk mapping engine",
                "Specialist database (10 verified physicians)",
            ],
            "pipeline_version": "HealthPilot AI v3.0 — Multi-Agent Clinical Decision Support",
        }


DOCTOR_DATABASE = [
    {
        "id": "d001",
        "name": "Dr. Sarah Chen",
        "specialty": "Cardiologist",
        "experience_years": 18,
        "qualifications": ["MD", "FACC", "Board Certified Cardiology"],
        "hospital": "City Heart Institute",
        "rating": 4.9,
        "reviews": 312,
        "availability": "Mon, Wed, Fri",
        "languages": ["English", "Mandarin"],
        "bio": "Specializes in interventional cardiology and heart failure management.",
        "accepts_insurance": True,
    },
    {
        "id": "d002",
        "name": "Dr. James Okafor",
        "specialty": "Pulmonologist",
        "experience_years": 14,
        "qualifications": ["MD", "FCCP", "Board Certified Pulmonology"],
        "hospital": "Metro Respiratory Center",
        "rating": 4.8,
        "reviews": 198,
        "availability": "Tue, Thu, Sat",
        "languages": ["English"],
        "bio": "Expert in asthma, COPD, and sleep-related breathing disorders.",
        "accepts_insurance": True,
    },
    {
        "id": "d003",
        "name": "Dr. Priya Sharma",
        "specialty": "Neurologist",
        "experience_years": 12,
        "qualifications": ["MD", "DM Neurology", "Board Certified"],
        "hospital": "NeuroHealth Clinic",
        "rating": 4.7,
        "reviews": 245,
        "availability": "Mon, Tue, Thu",
        "languages": ["English", "Hindi"],
        "bio": "Specializes in headache disorders, epilepsy, and stroke management.",
        "accepts_insurance": True,
    },
    {
        "id": "d004",
        "name": "Dr. Michael Torres",
        "specialty": "Gastroenterologist",
        "experience_years": 20,
        "qualifications": ["MD", "FACG", "Board Certified GI"],
        "hospital": "Digestive Health Center",
        "rating": 4.9,
        "reviews": 421,
        "availability": "Mon–Fri",
        "languages": ["English", "Spanish"],
        "bio": "Expert in IBD, liver disease, and advanced endoscopy.",
        "accepts_insurance": True,
    },
    {
        "id": "d005",
        "name": "Dr. Aisha Rahman",
        "specialty": "General Physician",
        "experience_years": 10,
        "qualifications": ["MBBS", "MD Internal Medicine"],
        "hospital": "Community Health Clinic",
        "rating": 4.8,
        "reviews": 567,
        "availability": "Mon–Sat",
        "languages": ["English", "Arabic", "Urdu"],
        "bio": "Primary care physician focused on preventive medicine and chronic disease management.",
        "accepts_insurance": True,
    },
    {
        "id": "d006",
        "name": "Dr. Robert Kim",
        "specialty": "Psychiatrist",
        "experience_years": 16,
        "qualifications": ["MD", "Board Certified Psychiatry", "CBT Certified"],
        "hospital": "MindWell Institute",
        "rating": 4.7,
        "reviews": 189,
        "availability": "Tue, Wed, Fri",
        "languages": ["English", "Korean"],
        "bio": "Specializes in anxiety, depression, and cognitive behavioral therapy.",
        "accepts_insurance": True,
    },
    {
        "id": "d007",
        "name": "Dr. Elena Vasquez",
        "specialty": "Dermatologist",
        "experience_years": 11,
        "qualifications": ["MD", "Board Certified Dermatology", "FAAD"],
        "hospital": "SkinCare Specialists",
        "rating": 4.6,
        "reviews": 334,
        "availability": "Mon, Wed, Thu",
        "languages": ["English", "Spanish"],
        "bio": "Expert in inflammatory skin conditions, skin cancer screening, and cosmetic dermatology.",
        "accepts_insurance": True,
    },
    {
        "id": "d008",
        "name": "Dr. David Nguyen",
        "specialty": "Urologist",
        "experience_years": 15,
        "qualifications": ["MD", "FACS", "Board Certified Urology"],
        "hospital": "Urology Associates",
        "rating": 4.8,
        "reviews": 276,
        "availability": "Mon, Tue, Thu, Fri",
        "languages": ["English", "Vietnamese"],
        "bio": "Specializes in urinary tract disorders, kidney stones, and minimally invasive surgery.",
        "accepts_insurance": True,
    },
    {
        "id": "d009",
        "name": "Dr. Fatima Al-Hassan",
        "specialty": "Endocrinologist",
        "experience_years": 13,
        "qualifications": ["MD", "Board Certified Endocrinology", "CDE"],
        "hospital": "Diabetes & Hormone Center",
        "rating": 4.9,
        "reviews": 388,
        "availability": "Mon, Wed, Fri",
        "languages": ["English", "Arabic"],
        "bio": "Expert in diabetes management, thyroid disorders, and hormonal imbalances.",
        "accepts_insurance": True,
    },
    {
        "id": "d010",
        "name": "Dr. Thomas Wright",
        "specialty": "Rheumatologist",
        "experience_years": 17,
        "qualifications": ["MD", "FACR", "Board Certified Rheumatology"],
        "hospital": "Arthritis & Rheumatology Center",
        "rating": 4.7,
        "reviews": 203,
        "availability": "Tue, Thu",
        "languages": ["English"],
        "bio": "Specializes in rheumatoid arthritis, lupus, and autoimmune joint diseases.",
        "accepts_insurance": True,
    },
]


class DoctorRecommendationAgent:
    specialty_map = {
        "chest pain": "Cardiologist",
        "palpitations": "Cardiologist",
        "shortness of breath": "Pulmonologist",
        "cough": "Pulmonologist",
        "headache": "Neurologist",
        "dizziness": "Neurologist",
        "blurred vision": "Neurologist",
        "numbness": "Neurologist",
        "abdominal pain": "Gastroenterologist",
        "diarrhea": "Gastroenterologist",
        "rash": "Dermatologist",
        "anxiety": "Psychiatrist",
        "insomnia": "Psychiatrist",
        "painful urination": "Urologist",
        "frequent urination": "Urologist",
        "joint pain": "Rheumatologist",
        "back pain": "Orthopedist",
        "weight loss": "Endocrinologist",
        "night sweats": "Hematologist",
        "fatigue": "General Physician",
        "fever": "General Physician",
    }

    def recommend(self, symptoms: list[str], risk_level: str, patient_info: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
        needed_specialties = list({self.specialty_map.get(s, "General Physician") for s in symptoms})
        if not needed_specialties:
            needed_specialties = ["General Physician"]

        matched = [d for d in DOCTOR_DATABASE if d["specialty"] in needed_specialties]
        if not matched:
            matched = [d for d in DOCTOR_DATABASE if d["specialty"] == "General Physician"]

        # Sort by rating desc, then experience desc
        matched.sort(key=lambda d: (d["rating"], d["experience_years"]), reverse=True)

        result = []
        for doc in matched[:4]:
            match_reasons = [s for s in symptoms if self.specialty_map.get(s) == doc["specialty"]]
            result.append({
                **doc,
                "match_reasons": match_reasons or symptoms[:2],
                "urgency_note": "Urgent consultation recommended" if risk_level == "HIGH" else "Schedule within 1–2 weeks",
            })
        return result


class ReportGeneratorAgent:
    def generate(
        self,
        symptoms: list[str],
        risk: dict[str, Any],
        recommendations: dict[str, Any],
        llm_analysis: dict[str, Any],
        patient_info: Optional[dict[str, Any]],
        explainability: dict[str, Any],
    ) -> dict[str, Any]:
        patient_info = patient_info or {}
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        return {
            "report_title": "AI Health Assessment Report",
            "generated_at": now,
            "patient_summary": {
                "age": patient_info.get("age", "Unknown"),
                "gender": patient_info.get("gender", "Unknown"),
                "chronic_conditions": patient_info.get("chronic_conditions", []),
                "allergies": patient_info.get("allergies", []),
                "medications": patient_info.get("medications", []),
            },
            "chief_complaint": ", ".join(symptoms[:5]),
            "risk_summary": {
                "level": risk["level"],
                "score": risk.get("risk_score", 0),
                "urgency": risk["urgency"],
                "confidence": risk["confidence"],
            },
            "clinical_assessment": llm_analysis.get("assessment", ""),
            "possible_conditions": llm_analysis.get("possible_conditions", []),
            "explanation": llm_analysis.get("explanation", ""),
            "recommended_tests": recommendations.get("tests", []),
            "recommended_specialists": recommendations.get("doctors", []),
            "lifestyle_advice": recommendations.get("lifestyle", []),
            "precautions": recommendations.get("precautions", []),
            "follow_up_questions": llm_analysis.get("follow_up_questions", []),
            "emergency_warning": llm_analysis.get("emergency_warning"),
            "ai_explainability": explainability,
            "disclaimer": "This report is generated by an AI decision support system and is NOT a medical diagnosis. Always consult a qualified healthcare professional.",
        }


class RiskDecisionAgent:
    def build_graph(self, symptoms: list[str], risk: dict[str, Any], llm_analysis: dict[str, Any]) -> dict[str, Any]:
        nodes = [{"id": "input", "label": "Patient Input", "type": "input"}]
        edges = []

        for i, symptom in enumerate(symptoms[:6]):
            node_id = f"symptom_{i}"
            nodes.append({"id": node_id, "label": symptom.title(), "type": "symptom"})
            edges.append({"from": "input", "to": node_id})

        nodes.append({"id": "rag", "label": "RAG Retrieval", "type": "process"})
        nodes.append({"id": "llm", "label": "LLM Analysis", "type": "process"})
        nodes.append({"id": "risk", "label": f"Risk: {risk['level']}", "type": "risk", "color": risk["color"]})

        for i in range(min(len(symptoms), 6)):
            edges.append({"from": f"symptom_{i}", "to": "rag"})
        edges.append({"from": "rag", "to": "llm"})
        edges.append({"from": "llm", "to": "risk"})

        for i, condition in enumerate(llm_analysis.get("possible_conditions", [])[:3]):
            node_id = f"condition_{i}"
            nodes.append({"id": node_id, "label": condition, "type": "condition"})
            edges.append({"from": "risk", "to": node_id})

        return {
            "nodes": nodes,
            "edges": edges,
            "risk_score": risk.get("risk_score", 0),
            "risk_level": risk["level"],
            "risk_color": risk["color"],
            "decision_path": ["Symptom Extraction", "RAG Context Retrieval", "LLM Synthesis", "Risk Classification", "Recommendation"],
        }


class ConsultationPrepAgent:
    # Questions the PATIENT should ask the DOCTOR
    question_templates = {
        "fever": [
            "What could be causing my fever and how serious is it?",
            "Should I be taking any medication to bring my temperature down?",
            "At what temperature should I go to the emergency room?",
            "How long should I wait before coming back if the fever doesn't go away?",
        ],
        "cough": [
            "What is likely causing my cough and is it contagious?",
            "Do I need any tests like a chest X-ray or breathing test?",
            "Is there anything I can take to relieve the cough safely?",
            "When should I be worried that my cough is something more serious?",
        ],
        "chest pain": [
            "Could this chest pain be related to my heart, and do I need an ECG?",
            "What tests do you recommend to find out what's causing this pain?",
            "Are there any activities I should avoid until we know what's causing it?",
            "What warning signs should make me call 999 or go to A&E immediately?",
        ],
        "headache": [
            "What type of headache do you think I have, and what's causing it?",
            "Do I need a brain scan or any other tests?",
            "What can I take for the pain, and is it safe with my other medications?",
            "Are there any triggers I should avoid to prevent future headaches?",
        ],
        "shortness of breath": [
            "What is causing my breathlessness and how serious is it?",
            "Do I need a breathing test or chest X-ray?",
            "Should I be using an inhaler or any other treatment?",
            "What activities are safe for me to do while I have this symptom?",
        ],
        "fatigue": [
            "What blood tests should I have to find out why I'm so tired?",
            "Could my tiredness be related to my diet, sleep, or any medications I'm taking?",
            "Is there anything I can do right now to improve my energy levels?",
            "When should I expect to start feeling better?",
        ],
        "abdominal pain": [
            "What do you think is causing my stomach pain?",
            "Do I need an ultrasound or any blood tests?",
            "Are there foods I should avoid or eat more of?",
            "What pain relief is safe for me to take at home?",
        ],
        "dizziness": [
            "What is causing my dizziness — could it be my blood pressure or inner ear?",
            "Do I need any tests to rule out a serious cause?",
            "Is it safe for me to drive or exercise while I have this?",
            "What should I do if I feel faint or lose my balance?",
        ],
        "nausea": [
            "What is causing my nausea and is it something I should be worried about?",
            "What can I take to settle my stomach safely?",
            "Are there foods or drinks I should avoid?",
            "When should nausea be a reason to go to A&E?",
        ],
        "rash": [
            "What is causing this rash and is it contagious?",
            "Do I need any allergy tests or skin tests?",
            "What cream or treatment do you recommend?",
            "Are there any triggers I should avoid to prevent it coming back?",
        ],
        "joint pain": [
            "Could this be arthritis or another joint condition?",
            "What tests do I need — X-ray, blood tests?",
            "What pain relief is safe for me to take long-term?",
            "Are there exercises or physiotherapy that could help?",
        ],
        "palpitations": [
            "Could my heart rhythm be abnormal and do I need an ECG or heart monitor?",
            "Are my palpitations related to stress, caffeine, or a medical condition?",
            "Should I avoid any activities or substances?",
            "What symptoms alongside palpitations should make me call for emergency help?",
        ],
        "back pain": [
            "What is causing my back pain — is it muscular or could it be a disc problem?",
            "Do I need an X-ray or MRI scan?",
            "What exercises or stretches are safe for me to do?",
            "How long should I expect this to last and when should I come back?",
        ],
        "insomnia": [
            "What could be causing my sleep problems?",
            "Are there any sleep medications that are safe for me to take?",
            "What sleep hygiene changes would you recommend for my situation?",
            "Should I be referred to a sleep specialist?",
        ],
        "anxiety": [
            "What treatment options are available for my anxiety?",
            "Would therapy, medication, or both be right for me?",
            "Are there any lifestyle changes that could help reduce my anxiety?",
            "How do I know if my anxiety is getting worse and needs urgent attention?",
        ],
    }

    general_questions = [
        "Based on my symptoms, what do you think is the most likely cause?",
        "What tests or investigations do you recommend and why?",
        "What are my treatment options and what do you recommend for me specifically?",
        "Are there any side effects I should watch out for with the treatment?",
        "How long will it take to feel better, and when should I come back if I don't improve?",
        "Is there anything in my lifestyle — diet, exercise, stress — that could be making this worse?",
        "Are there any red flag symptoms that should make me seek emergency care?",
        "Should I see a specialist, and if so, who would you refer me to?",
    ]

    def prepare(self, symptoms: list[str], patient_info: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        patient_info = patient_info or {}
        symptom_questions: list[str] = []
        for symptom in symptoms:
            symptom_questions.extend(self.question_templates.get(symptom, []))

        bring_list = [
            "A written list of all your symptoms and when they started",
            "List of all current medications, doses, and how often you take them",
            "Your insurance card and photo ID",
            "Any previous test results, scans, or letters from other doctors",
        ]
        if patient_info.get("chronic_conditions"):
            bring_list.append("Records of how your chronic conditions have been managed recently")
        if patient_info.get("allergies"):
            bring_list.append("Written list of all known allergies and what reactions you've had")

        return {
            "symptom_specific_questions": symptom_questions[:8],
            "general_questions": self.general_questions[:5],
            "what_to_bring": bring_list,
            "what_to_tell_doctor": [
                f"I've been experiencing: {', '.join(symptoms[:5])}",
                "When each symptom started and whether it's getting better, worse, or staying the same",
                "Anything that makes the symptoms better or worse (e.g. rest, food, movement)",
                "Any similar symptoms in the past and what happened then",
                "Any recent changes to your medications, diet, travel, or stress levels",
            ],
            "red_flags_to_mention": [
                s for s in symptoms
                if s in ["chest pain", "shortness of breath", "confusion", "vision loss", "numbness"]
            ],
            "preparation_tips": [
                "Write your questions down before the appointment so you don't forget them.",
                "Be honest about your lifestyle — alcohol, smoking, diet, and stress all matter.",
                "Ask the doctor to explain anything you don't understand in plain language.",
                "Bring a trusted friend or family member if you'd like support or help remembering what was said.",
                "Don't leave without knowing what the next step is — a test, a referral, or a follow-up date.",
            ],
        }
