from __future__ import annotations

import json
import os
from typing import Any, Optional

try:
    from openai import OpenAI
except Exception:
    OpenAI = None


def build_prompt(
    symptoms: list[str],
    context_docs: list[dict[str, Any]],
    patient_info: Optional[dict[str, Any]] = None,
    duration: str = "not specified",
    severity: str = "moderate",
) -> str:
    patient_info = patient_info or {}
    context_text = "\n".join(
        f"  [{i+1}] Category: {doc.get('category','general')} | Relevance: {doc.get('score',0):.2f}\n"
        f"       {doc.get('text','')[:300]}"
        for i, doc in enumerate(context_docs[:5])
    ) or "  No external clinical context retrieved."

    age = patient_info.get("age", "not specified")
    gender = patient_info.get("gender", "not specified")
    chronic = patient_info.get("chronic_conditions") or []
    allergies = patient_info.get("allergies") or []
    meds = patient_info.get("medications") or []
    symptom_list = "\n".join(f"  • {s}" for s in symptoms)

    return f"""You are a senior clinical AI assistant operating within a healthcare decision support system. Your role is to provide a thorough, evidence-informed, and professionally worded health assessment based on the patient's reported symptoms and profile.

━━━ PATIENT PROFILE ━━━
  Age: {age} | Gender: {gender}
  Chronic Conditions: {', '.join(chronic) if chronic else 'None reported'}
  Known Allergies: {', '.join(allergies) if allergies else 'None reported'}
  Current Medications: {', '.join(meds) if meds else 'None reported'}

━━━ REPORTED SYMPTOMS ━━━
  Duration: {duration} | Severity: {severity}
{symptom_list}

━━━ RETRIEVED CLINICAL CONTEXT (RAG) ━━━
{context_text}

━━━ CLINICAL ASSESSMENT INSTRUCTIONS ━━━
You must produce a professional, precise, and empathetic clinical assessment. Follow these standards:

1. ASSESSMENT: Write 2–4 sentences in professional clinical language. Address each reported symptom individually. Acknowledge the patient's concern with empathy. Do not be dismissive.

2. SYMPTOM BREAKDOWN: For each symptom, provide a specific clinical interpretation — not generic statements. Reference the patient's age, gender, and chronic conditions where relevant.

3. POSSIBLE CONDITIONS: List 2–4 differential diagnoses in order of likelihood. For each:
   - Explain precisely which combination of symptoms supports this diagnosis
   - Note any patient risk factors that increase or decrease likelihood
   - Use proper medical terminology with plain-language explanation in parentheses

4. EXPLANATION: Provide a detailed clinical reasoning paragraph (3–5 sentences) that:
   - Links the symptom pattern to the differential diagnoses
   - References the retrieved clinical context where applicable
   - Acknowledges uncertainty appropriately

5. CONFIDENCE: Score 0.0–1.0 based on symptom-pattern clarity, RAG evidence quality, and patient profile completeness. Explain your reasoning.

6. FOLLOW-UP QUESTIONS: Ask 3 targeted, clinically relevant questions specific to the reported symptoms — not generic questions.

7. EMERGENCY WARNING: If any red-flag symptoms are present (chest pain, shortness of breath, confusion, sudden vision loss, severe headache, signs of stroke), state this clearly and urgently.

8. LIFESTYLE ADVICE: Provide 3–4 specific, actionable recommendations tailored to this patient's age, gender, and conditions — not generic advice.

9. CARE PLAN: Provide a structured 3-step plan: immediate action, short-term management, and follow-up.

10. TONE: Professional, empathetic, and clear. Write as a senior clinician would communicate to a patient — informative but not alarming, precise but not cold.

Return ONLY valid JSON with this exact structure:
{{
  "assessment": "Professional 2-4 sentence clinical summary addressing each symptom with empathy and precision",
  "symptom_breakdown": {{
    "<symptom_name>": "Specific clinical interpretation for this symptom given the patient's profile"
  }},
  "possible_conditions": [
    {{
      "name": "Condition name (plain-language explanation)",
      "likelihood": "high|medium|low",
      "matching_symptoms": ["symptom1", "symptom2"],
      "reasoning": "Precise clinical reasoning linking symptoms and patient factors to this diagnosis",
      "supporting_evidence": "Reference to retrieved context or clinical knowledge"
    }}
  ],
  "explanation": "Detailed 3-5 sentence clinical reasoning paragraph with differential diagnosis rationale",
  "confidence_score": 0.0,
  "confidence_rationale": "Explanation of confidence level based on symptom clarity, evidence quality, and profile completeness",
  "follow_up_questions": [
    "Targeted clinical question 1",
    "Targeted clinical question 2",
    "Targeted clinical question 3"
  ],
  "emergency_warning": null,
  "lifestyle_advice": [
    "Specific, actionable advice tailored to this patient",
    "Specific advice 2",
    "Specific advice 3"
  ],
  "care_plan": [
    "Immediate: specific action within the next hours/day",
    "Short-term: management over the next 1-2 weeks",
    "Follow-up: monitoring and review plan"
  ],
  "red_flags_detected": [],
  "clinical_notes": "Any additional clinical observations or caveats the patient should be aware of"
}}""".strip()


def build_critique_prompt(original_response: dict[str, Any], symptoms: list[str]) -> str:
    return f"""You are a senior medical AI quality reviewer. Critically evaluate this clinical assessment for professional quality, accuracy, and completeness.

SYMPTOMS REPORTED: {', '.join(symptoms)}

ASSESSMENT TO REVIEW:
{json.dumps(original_response, indent=2)}

Evaluate against these clinical standards:
1. Is the assessment professionally worded and empathetic — not generic or dismissive?
2. Does the symptom breakdown address each symptom with specific clinical insight?
3. Are the differential diagnoses well-reasoned with precise symptom-to-condition mapping?
4. Are follow-up questions clinically targeted — not generic?
5. Is the confidence score calibrated appropriately to the evidence?
6. Are any red flags or emergency symptoms missed?
7. Is the care plan actionable and appropriately urgent?
8. Is the tone professional and suitable for a patient-facing clinical tool?

Return ONLY valid JSON:
{{
  "quality_score": 0.0,
  "issues": ["specific issue 1", "specific issue 2"],
  "is_acceptable": true,
  "suggested_improvements": ["specific improvement 1", "specific improvement 2"],
  "clinical_accuracy": "high|medium|low",
  "professionalism_score": 0.0
}}""".strip()


def build_refined_prompt(
    original: dict[str, Any],
    critique: dict[str, Any],
    symptoms: list[str],
    context_docs: list[dict[str, Any]],
    patient_info: Optional[dict[str, Any]],
) -> str:
    return f"""You are a senior clinical AI assistant. Your previous assessment was reviewed and found to have quality issues. Produce an improved version.

SYMPTOMS: {', '.join(symptoms)}
PATIENT: Age {patient_info.get('age', 'unknown')}, {patient_info.get('gender', 'unknown')}
CHRONIC CONDITIONS: {', '.join(patient_info.get('chronic_conditions') or []) or 'None'}

PREVIOUS ASSESSMENT (to improve upon):
{json.dumps(original, indent=2)}

QUALITY ISSUES IDENTIFIED:
{json.dumps(critique.get('issues', []), indent=2)}

REQUIRED IMPROVEMENTS:
{json.dumps(critique.get('suggested_improvements', []), indent=2)}

Produce a significantly improved assessment that:
- Uses professional clinical language throughout
- Addresses each symptom with specific clinical insight
- Provides well-reasoned differential diagnoses
- Asks targeted, symptom-specific follow-up questions
- Gives actionable, patient-specific recommendations

Return ONLY valid JSON with the same structure as before.""".strip()


def _normalize_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        cleaned = cleaned.replace("json", "", 1).strip()
    return json.loads(cleaned)


def _fallback_response(symptoms: list[str], context_docs: list[dict[str, Any]]) -> dict[str, Any]:
    breakdown = {
        s: f"Your reported symptom of {s} warrants clinical evaluation. A thorough assessment requires examination findings and medical history that are beyond the scope of this automated review."
        for s in symptoms
    }
    return {
        "assessment": (
            f"Thank you for reporting your symptoms. You have described {len(symptoms)} symptom(s): "
            f"{', '.join(symptoms[:4])}{',' if len(symptoms) > 4 else ''}. "
            "Our AI engine is temporarily unavailable, so this response is generated by our clinical heuristic system. "
            "Please consult a healthcare professional for a comprehensive evaluation."
        ),
        "symptom_breakdown": breakdown,
        "possible_conditions": [
            {
                "name": "Viral illness (common viral infection)",
                "likelihood": "medium",
                "matching_symptoms": symptoms[:2],
                "reasoning": "Multiple concurrent symptoms are commonly associated with viral aetiology, particularly in the absence of specific localising features.",
                "supporting_evidence": "General clinical knowledge — RAG context unavailable",
            },
            {
                "name": "Inflammatory condition (systemic inflammation)",
                "likelihood": "low",
                "matching_symptoms": symptoms[:1],
                "reasoning": "Systemic symptoms may indicate an inflammatory process requiring further investigation.",
                "supporting_evidence": "Heuristic assessment only",
            },
        ],
        "explanation": (
            "This assessment has been generated by the heuristic fallback engine due to temporary LLM unavailability. "
            "The differential diagnoses presented are based on general symptom patterns and should be interpreted with caution. "
            "A full AI-powered assessment with retrieved clinical context will provide significantly more precise guidance. "
            "Please seek professional medical advice for an accurate diagnosis."
        ),
        "confidence_score": 0.35,
        "confidence_rationale": "Confidence is substantially reduced as this response was generated without LLM synthesis or RAG context retrieval.",
        "follow_up_questions": [
            "When did each of your symptoms first appear, and have they changed in character or severity since onset?",
            "Have you experienced these symptoms previously, and if so, what was the outcome?",
            "Are you currently taking any medications, including over-the-counter preparations or supplements?",
        ],
        "emergency_warning": (
            "Please seek emergency medical attention immediately if you experience chest pain, "
            "severe difficulty breathing, sudden confusion, loss of consciousness, or signs of stroke "
            "(facial drooping, arm weakness, speech difficulty)."
        ),
        "lifestyle_advice": [
            "Ensure adequate rest and maintain hydration with at least 2 litres of fluid daily.",
            "Monitor your temperature every 4–6 hours and keep a symptom diary to share with your clinician.",
            "Avoid strenuous physical activity until your symptoms have been assessed by a healthcare professional.",
        ],
        "care_plan": [
            "Immediate: Contact your GP or a telehealth service today to discuss your symptoms.",
            "Short-term: If symptoms worsen or new symptoms develop, seek urgent medical review.",
            "Follow-up: Arrange a formal clinical assessment within 48–72 hours if symptoms persist.",
        ],
        "red_flags_detected": [s for s in symptoms if s in ["chest pain", "shortness of breath", "confusion", "vision loss", "numbness"]],
        "clinical_notes": "This is a heuristic-only response. Full AI assessment will be available once the LLM service is restored.",
    }


def _call_llm(prompt: str) -> str | None:
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    if gemini_key:
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=gemini_key)
            model_obj = genai_legacy.GenerativeModel(model)
            response = model_obj.generate_content(
                prompt,
                generation_config=genai_legacy.GenerationConfig(temperature=0.2, max_output_tokens=4096)
            )
            return response.text
        except Exception as e:
            print(f"[LLM] Gemini error ({model}): {e}")

    if openai_key and OpenAI is not None:
        try:
            client = OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=4096,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[LLM] OpenAI error: {e}")

    print("[LLM] No provider available — using fallback")
    return None


def call_gemini_or_openai(
    prompt: str,
    symptoms: list[str],
    context_docs: list[dict[str, Any]],
    patient_info: Optional[dict[str, Any]] = None,
    use_critique: bool = True,
) -> dict[str, Any]:
    """
    Agentic LLM pipeline:
    Step 1 — Generate initial clinical assessment
    Step 2 — Critique for professional quality and clinical accuracy
    Step 3 — Refine if quality score < 0.75 or not acceptable
    """
    raw = _call_llm(prompt)
    if raw is None:
        return _fallback_response(symptoms, context_docs)

    try:
        result = _normalize_json(raw)
    except Exception:
        return _fallback_response(symptoms, context_docs) | {"explanation": raw[:1200]}

    # Normalise possible_conditions to always be list of dicts
    conditions = result.get("possible_conditions", [])
    if conditions and isinstance(conditions[0], str):
        result["possible_conditions"] = [
            {"name": c, "likelihood": "medium", "matching_symptoms": [], "reasoning": "", "supporting_evidence": ""}
            for c in conditions
        ]

    if not use_critique:
        return result

    # ── Critique loop ──────────────────────────────────────────────────────
    critique_raw = _call_llm(build_critique_prompt(result, symptoms))
    if critique_raw is None:
        return result

    try:
        critique = _normalize_json(critique_raw)
    except Exception:
        return result

    result["_critique"] = {
        "quality_score": critique.get("quality_score", 0),
        "clinical_accuracy": critique.get("clinical_accuracy", "unknown"),
        "professionalism_score": critique.get("professionalism_score", 0),
        "issues_count": len(critique.get("issues", [])),
    }

    # Refine if quality is below threshold
    if not critique.get("is_acceptable", True) or critique.get("quality_score", 1.0) < 0.75:
        refined_raw = _call_llm(build_refined_prompt(result, critique, symptoms, context_docs, patient_info or {}))
        if refined_raw:
            try:
                refined = _normalize_json(refined_raw)
                refined["_critique"] = result["_critique"]
                refined["_refined"] = True
                conditions = refined.get("possible_conditions", [])
                if conditions and isinstance(conditions[0], str):
                    refined["possible_conditions"] = [
                        {"name": c, "likelihood": "medium", "matching_symptoms": [], "reasoning": "", "supporting_evidence": ""}
                        for c in conditions
                    ]
                return refined
            except Exception:
                pass

    return result
